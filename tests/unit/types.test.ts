/**
 * Unit Tests — Type Definitions
 * Tests SDK type exports and type safety
 */

import {
  ProviderName,
  RoleName,
  AILinkConfig,
  RunOptions,
  Message,
  AILinkResult,
  UsageLog,
  ProviderResponse,
  ToolCall,
  ValidationResult,
  AILinkTool,
} from '../../src/types';

describe('Type Definitions', () => {
  describe('ProviderName Type', () => {
    it('should accept valid provider names', () => {
      const providers: ProviderName[] = ['gemini', 'openai', 'claude', 'groq'];
      expect(providers).toHaveLength(4);
    });
  });

  describe('RoleName Type', () => {
    it('should accept valid role names', () => {
      const roles: RoleName[] = ['user', 'admin', 'developer'];
      expect(roles).toHaveLength(3);
    });
  });

  describe('AILinkConfig Interface', () => {
    it('should allow required config properties', () => {
      const config: AILinkConfig = {
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'provider-key',
      };

      expect(config.platformKey).toBe('test-key');
      expect(config.provider).toBe('gemini');
      expect(config.providerKey).toBe('provider-key');
    });

    it('should allow optional config properties', () => {
      const config: AILinkConfig = {
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'provider-key',
        environment: 'production',
        fallback: ['openai', 'claude'],
        retries: 3,
        retryDelay: 500,
        platformUrl: 'https://custom.platform.com',
      };

      expect(config.environment).toBe('production');
      expect(config.fallback).toEqual(['openai', 'claude']);
      expect(config.retries).toBe(3);
      expect(config.retryDelay).toBe(500);
      expect(config.platformUrl).toBe('https://custom.platform.com');
    });

    it('should have default retry values', () => {
      const config: AILinkConfig = {
        platformKey: 'key',
        provider: 'gemini',
        providerKey: 'pkey',
      };

      // Type should allow retries and retryDelay to be optional
      expect(config.retries).toBeUndefined();
      expect(config.retryDelay).toBeUndefined();
    });
  });

  describe('RunOptions Interface', () => {
    it('should allow user role and sessionId', () => {
      const options: RunOptions = {
        userRole: 'user',
        sessionId: 'session-123',
        groups: ['inventory'],
      };

      expect(options.userRole).toBe('user');
      expect(options.sessionId).toBe('session-123');
      expect(options.groups).toEqual(['inventory']);
    });

    it('should allow empty groups array', () => {
      const options: RunOptions = {
        userRole: 'admin',
        sessionId: 'session-456',
        groups: [],
      };

      expect(options.groups).toEqual([]);
    });

    it('should have all properties optional', () => {
      const options: RunOptions = {};
      expect(Object.keys(options)).toHaveLength(0);
    });
  });

  describe('Message Interface', () => {
    it('should create user message', () => {
      const message: Message = {
        role: 'user',
        content: 'What is the inventory?',
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('What is the inventory?');
    });

    it('should create assistant message', () => {
      const message: Message = {
        role: 'assistant',
        content: 'The inventory contains...',
      };

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('The inventory contains...');
    });

    it('should create tool message', () => {
      const message: Message = {
        role: 'tool',
        content: 'Tool result',
        toolName: 'checkInventory',
        toolResult: { stock: 100 },
      };

      expect(message.role).toBe('tool');
      expect(message.toolName).toBe('checkInventory');
    });

    it('should support multi-line content', () => {
      const message: Message = {
        role: 'user',
        content: 'Line 1\nLine 2\nLine 3',
      };

      expect(message.content).toContain('\n');
      expect(message.content.split('\n')).toHaveLength(3);
    });
  });

  describe('AILinkResult Interface', () => {
    it('should contain all required properties', () => {
      const result: AILinkResult = {
        response: 'The item is in stock',
        toolsCalled: ['checkInventory'],
        allowedTools: ['checkInventory', 'getOrderStatus'],
        executionTime: 245,
        provider: 'gemini',
        userRole: 'user',
        groups: ['inventory'],
      };

      expect(result.response).toBeDefined();
      expect(result.toolsCalled).toBeDefined();
      expect(result.allowedTools).toBeDefined();
      expect(result.executionTime).toBeDefined();
      expect(result.provider).toBeDefined();
      expect(result.userRole).toBeDefined();
      expect(result.groups).toBeDefined();
    });

    it('should allow empty arrays', () => {
      const result: AILinkResult = {
        response: 'Just a text response',
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'openai',
        userRole: 'admin',
        groups: [],
      };

      expect(result.toolsCalled).toEqual([]);
      expect(result.allowedTools).toEqual([]);
      expect(result.groups).toEqual([]);
    });

    it('should track multiple tools called', () => {
      const result: AILinkResult = {
        response: 'Updated',
        toolsCalled: ['checkInventory', 'updateInventory', 'notifyWarehouse'],
        allowedTools: ['checkInventory', 'updateInventory', 'notifyWarehouse'],
        executionTime: 500,
        provider: 'claude',
        userRole: 'admin',
        groups: ['inventory', 'warehouse'],
      };

      expect(result.toolsCalled.length).toBe(3);
      expect(result.allowedTools.length).toBe(3);
    });
  });

  describe('UsageLog Interface', () => {
    it('should create usage log with all fields', () => {
      const log: UsageLog = {
        platformKey: 'test-key',
        timestamp: new Date().toISOString(),
        prompt: 'What is the inventory?',
        provider: 'gemini',
        userRole: 'user',
        groups: ['inventory'],
        toolsCalled: ['checkInventory'],
        allowedTools: ['checkInventory'],
        executionTime: 245,
        success: true,
      };

      expect(log.timestamp).toBeDefined();
      expect(log.prompt).toBeDefined();
      expect(log.platformKey).toBeDefined();
    });
  });

  describe('ProviderResponse Interface', () => {
    it('should create text response', () => {
      const response: ProviderResponse = {
        type: 'text',
        text: 'The inventory has 50 units',
      };

      expect(response.type).toBe('text');
      expect(response.text).toBe('The inventory has 50 units');
    });

    it('should create single tool call response', () => {
      const response: ProviderResponse = {
        type: 'tool_call',
        toolName: 'checkInventory',
        toolArgs: { productId: 'prod-123' },
      };

      expect(response.type).toBe('tool_call');
      expect(response.toolName).toBeDefined();
      expect(response.toolName).toBe('checkInventory');
    });

    it('should create parallel tool calls response', () => {
      const response: ProviderResponse = {
        type: 'tool_calls',
        toolCalls: [
          {
            toolName: 'checkInventory',
            toolArgs: { productId: 'prod-123' },
          },
          {
            toolName: 'getOrderStatus',
            toolArgs: { orderId: 'order-456' },
          },
        ],
      };

      expect(response.type).toBe('tool_calls');
      expect(response.toolCalls).toHaveLength(2);
    });
  });

  describe('ToolCall Interface', () => {
    it('should create tool call with required params', () => {
      const toolCall: ToolCall = {
        toolName: 'checkInventory',
        toolArgs: { productId: 'prod-123' },
      };

      expect(toolCall.toolName).toBe('checkInventory');
      expect(toolCall.toolArgs.productId).toBe('prod-123');
    });

    it('should support multiple arguments', () => {
      const toolCall: ToolCall = {
        toolName: 'updateInventory',
        toolArgs: {
          productId: 'prod-123',
          quantity: 50,
          location: 'warehouse-A',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      expect(toolCall.toolArgs.productId).toBe('prod-123');
      expect(toolCall.toolArgs.quantity).toBe(50);
      expect(toolCall.toolArgs.location).toBe('warehouse-A');
    });

    it('should support empty arguments', () => {
      const toolCall: ToolCall = {
        toolName: 'noParamsTool',
        toolArgs: {},
      };

      expect(toolCall.toolArgs).toEqual({});
    });
  });

  describe('ValidationResult Interface', () => {
    it('should create valid result', () => {
      const result: ValidationResult = {
        valid: true,
      };

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should create invalid result with errors', () => {
      const result: ValidationResult = {
        valid: false,
        errors: ['Field "productId" is required', 'Field "quantity" must be a number'],
      };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors![0]).toContain('productId');
    });
  });

  describe('AILinkTool Interface', () => {
    it('should create tool with all properties', () => {
      const tool: AILinkTool = {
        name: 'checkInventory',
        description: 'Check product inventory',
        schema: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
          },
          required: ['productId'],
        },
        execute: async () => ({ status: 'ok' }),
        roles: ['user', 'admin'],
        group: 'inventory',
      };

      expect(tool.name).toBe('checkInventory');
      expect(tool.description).toBe('Check product inventory');
      expect(tool.schema.type).toBe('object');
      expect(tool.roles).toEqual(['user', 'admin']);
      expect(tool.group).toBe('inventory');
    });

    it('should support tool without group', () => {
      const tool: AILinkTool = {
        name: 'genericTool',
        description: 'A generic tool',
        schema: { type: 'object', properties: {} },
        execute: async () => ({}),
        roles: ['user', 'admin', 'developer'],
      };

      expect(tool.name).toBe('genericTool');
      expect(tool.group).toBeUndefined();
    });
  });

  describe('Type Compatibility', () => {
    it('should allow provider names in config', () => {
      const provider: ProviderName = 'gemini';
      const config: AILinkConfig = {
        platformKey: 'key',
        provider,
        providerKey: 'pkey',
      };

      expect(config.provider).toBe('gemini');
    });

    it('should allow role names in options', () => {
      const role: RoleName = 'admin';
      const options: RunOptions = {
        userRole: role,
      };

      expect(options.userRole).toBe('admin');
    });

    it('should compose complex types', () => {
      const config: AILinkConfig = {
        platformKey: 'key',
        provider: 'gemini',
        providerKey: 'pkey',
        fallback: ['openai', 'claude'] as ProviderName[],
      };

      const options: RunOptions = {
        userRole: 'user' as RoleName,
        sessionId: 'session-123',
      };

      expect(config.fallback).toEqual(['openai', 'claude']);
      expect(options.userRole).toBe('user');
    });
  });
});
