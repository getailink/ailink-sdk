/**
 * Unit Tests — ClaudeAdapter
 * Verifies that execute() correctly formats assistant messages containing toolCalls
 * as an array of tool_use content blocks — not as plain strings.
 * No real API calls — Anthropic SDK client is fully mocked.
 */

import { ClaudeAdapter } from '../../src/providers/claude';
import { Message } from '../../src/types';

// ── Mock the entire @anthropic-ai/sdk module ──────────────────────────────────
// Capture the create mock so individual tests can inspect call arguments.

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }));
});

// ── Shared test data ──────────────────────────────────────────────────────────

const tool = {
  name: 'checkStock',
  description: 'Check how many units of a product are in stock',
  parameters: {
    type: 'object',
    properties: { productId: { type: 'string', description: 'Product ID to check' } },
    required: ['productId'],
  },
};

/** Minimal Anthropic response shape for a plain text reply */
function makeTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  };
}

/** Minimal Anthropic response shape for a single tool_use reply */
function makeToolUseResponse(id: string, name: string, input: Record<string, any>) {
  return {
    content: [{ type: 'tool_use', id, name, input }],
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
    adapter.initialize('test-claude-key');
    mockCreate.mockReset();
  });

  // ── Test 1: assistant message with toolCalls → tool_use content blocks ──────
  it('formats assistant message with toolCalls as an array of tool_use blocks', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('You have 42 units of laptop-001 in stock.'));

    const history: Message[] = [
      { role: 'user', content: 'Check stock for laptop-001' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { toolName: 'checkStock', toolArgs: { productId: 'laptop-001' }, callId: 'toolu_01abc' },
        ],
      },
      {
        role: 'tool',
        content: '42',
        toolName: 'checkStock',
        toolResult: 42,
        callId: 'toolu_01abc',
      },
    ];

    await adapter.execute(history, [tool]);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const sentMessages = mockCreate.mock.calls[0][0].messages;

    // The assistant message must be at index 1
    const assistantMsg = sentMessages[1];
    expect(assistantMsg.role).toBe('assistant');

    // Content must be an array — not a plain string
    expect(Array.isArray(assistantMsg.content)).toBe(true);
    expect(assistantMsg.content.length).toBe(1);

    // Each item must be a well-formed tool_use block
    const block = assistantMsg.content[0];
    expect(block.type).toBe('tool_use');
    expect(block.id).toBe('toolu_01abc');
    expect(block.name).toBe('checkStock');
    expect(block.input).toEqual({ productId: 'laptop-001' });
  });

  // ── Test 2: assistant message with toolCalls → NOT a plain string ───────────
  it('does not send assistant toolCalls message as a plain string', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('Done.'));

    const history: Message[] = [
      { role: 'user', content: 'Check stock for laptop-001' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { toolName: 'checkStock', toolArgs: { productId: 'laptop-001' }, callId: 'toolu_02xyz' },
        ],
      },
    ];

    await adapter.execute(history, [tool]);

    const sentMessages = mockCreate.mock.calls[0][0].messages;
    const assistantMsg = sentMessages[1];

    // content must not be a plain string — it must be an array of blocks
    expect(typeof assistantMsg.content).not.toBe('string');
    expect(Array.isArray(assistantMsg.content)).toBe(true);
  });

  // ── Test 3: multiple toolCalls → multiple tool_use blocks in array ──────────
  it('formats multiple toolCalls as multiple tool_use blocks in the content array', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('All results returned.'));

    const history: Message[] = [
      { role: 'user', content: 'Check stock for laptop-001 and tablet-002' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { toolName: 'checkStock', toolArgs: { productId: 'laptop-001' }, callId: 'toolu_01' },
          { toolName: 'checkStock', toolArgs: { productId: 'tablet-002' }, callId: 'toolu_02' },
        ],
      },
    ];

    await adapter.execute(history, [tool]);

    const sentMessages = mockCreate.mock.calls[0][0].messages;
    const assistantMsg = sentMessages[1];

    expect(Array.isArray(assistantMsg.content)).toBe(true);
    expect(assistantMsg.content.length).toBe(2);

    expect(assistantMsg.content[0]).toMatchObject({
      type: 'tool_use',
      id: 'toolu_01',
      name: 'checkStock',
      input: { productId: 'laptop-001' },
    });
    expect(assistantMsg.content[1]).toMatchObject({
      type: 'tool_use',
      id: 'toolu_02',
      name: 'checkStock',
      input: { productId: 'tablet-002' },
    });
  });

  // ── Test 4: plain assistant message (no toolCalls) → plain string content ───
  it('formats a plain assistant message as a plain string when no toolCalls', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('Follow-up answer.'));

    const history: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there, how can I help?' },
      { role: 'user', content: 'Tell me more' },
    ];

    await adapter.execute(history, []);

    const sentMessages = mockCreate.mock.calls[0][0].messages;
    const assistantMsg = sentMessages[1];

    // A plain assistant turn with no toolCalls should remain a string
    expect(assistantMsg.role).toBe('assistant');
    expect(typeof assistantMsg.content).toBe('string');
    expect(assistantMsg.content).toBe('Hi there, how can I help?');
  });

  // ── Test 5: tool result message → user role with tool_result block ──────────
  it('formats tool result messages as user role with tool_result content block', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('Got the result.'));

    const history: Message[] = [
      { role: 'user', content: 'Check stock' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { toolName: 'checkStock', toolArgs: { productId: 'laptop-001' }, callId: 'toolu_03' },
        ],
      },
      {
        role: 'tool',
        content: '99',
        toolName: 'checkStock',
        toolResult: 99,
        callId: 'toolu_03',
      },
    ];

    await adapter.execute(history, [tool]);

    const sentMessages = mockCreate.mock.calls[0][0].messages;
    // Tool result is at index 2
    const toolResultMsg = sentMessages[2];

    expect(toolResultMsg.role).toBe('user');
    expect(Array.isArray(toolResultMsg.content)).toBe(true);
    expect(toolResultMsg.content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_03',
      content: '99',
    });
  });

  // ── Test 6: text response is returned correctly ───────────────────────────
  it('returns a text response when the model returns a text block', async () => {
    mockCreate.mockResolvedValueOnce(makeTextResponse('Sunny in Paris.'));

    const result = await adapter.execute([{ role: 'user', content: 'Weather?' }], []);

    expect(result.type).toBe('text');
    expect(result.text).toBe('Sunny in Paris.');
  });

  // ── Test 7: single tool_use response is correctly parsed ──────────────────
  it('returns a tool_call response when the model requests a single tool', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse('toolu_04', 'checkStock', { productId: 'laptop-001' })
    );

    const result = await adapter.execute(
      [{ role: 'user', content: 'How many laptops?' }],
      [tool]
    );

    expect(result.type).toBe('tool_call');
    expect(result.toolName).toBe('checkStock');
    expect(result.toolArgs).toEqual({ productId: 'laptop-001' });
    expect(result.callId).toBe('toolu_04');
  });
});
