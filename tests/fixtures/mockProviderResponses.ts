/**
 * Mock Provider Responses
 * Simulates responses from OpenAI, Claude, Groq
 * (Gemini tested with real API)
 */

import { ProviderResponse, Message } from '../../src/types';

type OpenAIToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

type ClaudeToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
};

// ─────────────────────────────────────────────
// OpenAI Mock Responses
// ─────────────────────────────────────────────

export const openaiMockResponses = {
  singleToolCall: (toolName: string, toolArgs: any): any => ({
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              id: 'call_abc123',
              type: 'function',
              function: {
                name: toolName,
                arguments: JSON.stringify(toolArgs),
              },
            },
          ],
        },
      },
    ],
  }),

  parallelToolCalls: (tools: Array<{ name: string; args: any }>): any => ({
    choices: [
      {
        message: {
          content: null,
          tool_calls: tools.map((tool, i) => ({
            id: `call_${i}`,
            type: 'function',
            function: {
              name: tool.name,
              arguments: JSON.stringify(tool.args),
            },
          })),
        },
      },
    ],
  }),

  textResponse: (text: string): any => ({
    choices: [
      {
        message: {
          content: text,
          tool_calls: undefined,
        },
      },
    ],
  }),

  toolResult: (toolName: string, result: any): any => ({
    choices: [
      {
        message: {
          content: JSON.stringify(result),
        },
      },
    ],
  }),
};

// ─────────────────────────────────────────────
// Claude Mock Responses
// ─────────────────────────────────────────────

export const claudeMockResponses = {
  singleToolCall: (toolName: string, toolArgs: any): any => ({
    content: [
      {
        type: 'tool_use',
        id: 'tool_abc123',
        name: toolName,
        input: toolArgs,
      },
    ],
  }),

  parallelToolCalls: (tools: Array<{ name: string; args: any }>): any => ({
    content: tools.map((tool, i) => ({
      type: 'tool_use',
      id: `tool_${i}`,
      name: tool.name,
      input: tool.args,
    })),
  }),

  textResponse: (text: string): any => ({
    content: [
      {
        type: 'text',
        text,
      },
    ],
  }),

  toolResult: (toolName: string, result: any): any => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(result),
      },
    ],
  }),
};

// ─────────────────────────────────────────────
// Groq Mock Responses
// ─────────────────────────────────────────────

export const groqMockResponses = {
  // Groq uses OpenAI format
  singleToolCall: openaiMockResponses.singleToolCall,
  parallelToolCalls: openaiMockResponses.parallelToolCalls,
  textResponse: openaiMockResponses.textResponse,
  toolResult: openaiMockResponses.toolResult,
};

// ─────────────────────────────────────────────
// Provider Response Adapter
// ─────────────────────────────────────────────

export const adaptOpenAIResponse = (openaiResp: any): ProviderResponse => {
  const choice = openaiResp.choices?.[0];
  if (!choice) return { type: 'text', text: 'No response' };

  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    if (choice.message.tool_calls.length === 1) {
      const call = choice.message.tool_calls[0];
      return {
        type: 'tool_call',
        toolName: call.function.name,
        toolArgs: JSON.parse(call.function.arguments),
        callId: call.id,
      };
    }
    return {
      type: 'tool_calls',
      toolCalls: choice.message.tool_calls.map((call: OpenAIToolCall) => ({
        toolName: call.function.name,
        toolArgs: JSON.parse(call.function.arguments),
        callId: call.id,
      })),
    };
  }

  return {
    type: 'text',
    text: choice.message.content || '',
  };
};

export const adaptClaudeResponse = (claudeResp: any): ProviderResponse => {
  const content = claudeResp.content ?? [];
  
  const toolUseBlocks = content.filter((b: any) => b.type === 'tool_use');
  if (toolUseBlocks.length === 1) {
    return {
      type: 'tool_call',
      toolName: toolUseBlocks[0].name,
      toolArgs: toolUseBlocks[0].input,
      callId: toolUseBlocks[0].id,
    };
  }
  
  if (toolUseBlocks.length > 1) {
    return {
      type: 'tool_calls',
      toolCalls: toolUseBlocks.map((b: ClaudeToolUseBlock) => ({
        toolName: b.name,
        toolArgs: b.input,
        callId: b.id,
      })),
    };
  }

  const textBlock = content.find((b: any) => b.type === 'text');
  return {
    type: 'text',
    text: textBlock?.text || '',
  };
};

export const adaptGroqResponse = adaptOpenAIResponse; // Same as OpenAI

// ─────────────────────────────────────────────
// Mock Tool Definitions for Providers
// ─────────────────────────────────────────────

export const geminiToolDef = {
  functionDeclarations: [
    {
      name: 'checkInventory',
      description: 'Check product inventory',
      parameters: {
        type: 'OBJECT',
        properties: {
          productId: { type: 'string' },
        },
        required: ['productId'],
      },
    },
    {
      name: 'getOrderStatus',
      description: 'Get order status',
      parameters: {
        type: 'OBJECT',
        properties: {
          orderId: { type: 'string' },
        },
        required: ['orderId'],
      },
    },
  ],
};

export const openaiToolDef = [
  {
    type: 'function',
    function: {
      name: 'checkInventory',
      description: 'Check product inventory',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getOrderStatus',
      description: 'Get order status',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
        },
        required: ['orderId'],
      },
    },
  },
];

export const claudeToolDef = [
  {
    name: 'checkInventory',
    description: 'Check product inventory',
    input_schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'getOrderStatus',
    description: 'Get order status',
    input_schema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
      },
      required: ['orderId'],
    },
  },
];
