/**
 * Unit Tests — GroqAdapter
 * Verifies that execute() sends tool_choice: 'auto' and parallel_tool_calls: false
 * when tools are present, and omits both fields when no tools are provided.
 * No real API calls — Groq SDK client is fully mocked.
 */

import { GroqAdapter } from '../../src/providers/groq';
import { Message } from '../../src/types';

// ── Mock the entire groq-sdk module ──────────────────────────────────────────
// The mock must be hoisted (jest.mock is hoisted to the top of the file by Jest).
// We capture the create mock so individual tests can inspect calls.

const mockCreate = jest.fn();

jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

// ── Shared test data ──────────────────────────────────────────────────────────

const userMessage: Message = { role: 'user', content: 'What is the stock level for laptop-001?' };

const tool = {
  name: 'checkStock',
  description: 'Check how many units of a product are in stock',
  parameters: {
    type: 'object',
    properties: { productId: { type: 'string', description: 'Product ID to check' } },
    required: ['productId'],
  },
};

/** Minimal Groq response shape for a plain text reply */
function makeTextResponse(text: string) {
  return {
    choices: [
      {
        message: {
          content: text,
          tool_calls: null,
        },
      },
    ],
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GroqAdapter', () => {
  let adapter: GroqAdapter;

  beforeEach(() => {
    adapter = new GroqAdapter();
    adapter.initialize('test-groq-key');
    mockCreate.mockReset();
  });

  // ── Test 1: tool_choice and parallel_tool_calls are sent when tools present ──
  it('includes tool_choice: "auto" and parallel_tool_calls: false when tools are provided', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('You have 42 units of laptop-001 in stock.'));

    await adapter.execute([userMessage], [tool]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];

    // Tools array is present and non-empty
    expect(callArg.tools).toBeDefined();
    expect(callArg.tools.length).toBe(1);
    expect(callArg.tools[0].function.name).toBe('checkStock');

    // These fields must be present exactly as specified
    expect(callArg.tool_choice).toBe('auto');
    expect(callArg.parallel_tool_calls).toBe(false);
  });

  // ── Test 2: tool_choice and parallel_tool_calls are omitted when no tools ───
  it('omits tool_choice and parallel_tool_calls when no tools are provided', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('Hello from Groq.'));

    await adapter.execute([userMessage], []);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];

    // Neither field should appear when the tools array is empty
    expect(callArg.tool_choice).toBeUndefined();
    expect(callArg.parallel_tool_calls).toBeUndefined();
    // tools key itself must not be present either
    expect(callArg.tools).toBeUndefined();
  });

  // ── Test 3: response text is returned correctly ───────────────────────────
  it('returns a text response when the model returns plain content', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('Sunny in Tokyo.'));

    const result = await adapter.execute([userMessage], []);

    expect(result.type).toBe('text');
    expect(result.text).toBe('Sunny in Tokyo.');
  });

  // ── Test 4: single tool_call response is correctly parsed ─────────────────
  it('returns a tool_call response when the model requests a single tool', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_abc123',
                function: {
                  name: 'checkStock',
                  arguments: JSON.stringify({ productId: 'laptop-001' }),
                },
              },
            ],
          },
        },
      ],
    });

    const result = await adapter.execute([userMessage], [tool]);

    expect(result.type).toBe('tool_call');
    expect(result.toolName).toBe('checkStock');
    expect(result.toolArgs).toEqual({ productId: 'laptop-001' });
    expect(result.callId).toBe('call_abc123');
  });

  // ── Test 5: assistant history with toolCalls is formatted as tool_calls array
  it('formats assistant history message with toolCalls as Groq tool_calls array', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('Done.'));

    const historyWithAssistantToolCall: Message[] = [
      { role: 'user', content: 'Check stock for laptop-001' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { toolName: 'checkStock', toolArgs: { productId: 'laptop-001' }, callId: 'call_xyz' },
        ],
      },
      {
        role: 'tool',
        content: '42',
        toolName: 'checkStock',
        toolResult: 42,
        callId: 'call_xyz',
      },
    ];

    await adapter.execute(historyWithAssistantToolCall, [tool]);

    const sentMessages = mockCreate.mock.calls[0][0].messages;
    const assistantMsg = sentMessages[1];

    // Must be formatted as a tool_calls array — not as a plain string
    expect(assistantMsg.role).toBe('assistant');
    expect(assistantMsg.content).toBeNull();
    expect(Array.isArray(assistantMsg.tool_calls)).toBe(true);
    expect(assistantMsg.tool_calls[0]).toMatchObject({
      id: 'call_xyz',
      type: 'function',
      function: {
        name: 'checkStock',
        arguments: JSON.stringify({ productId: 'laptop-001' }),
      },
    });
  });
});
