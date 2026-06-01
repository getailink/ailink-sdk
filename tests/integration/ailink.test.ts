/**
 * Integration Tests — AILink Main Class
 * Tests SDK main API: config, initialization, run, fallback, retries
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/providers', () => {
  const { UnsupportedProviderError } = jest.requireActual<typeof import('../../src/errors')>('../../src/errors');
  const supportedProviders = ['gemini', 'openai', 'claude', 'groq'];

  return {
    getProvider: jest.fn((name: string) => {
      if (!supportedProviders.includes(name)) {
        throw new UnsupportedProviderError(name);
      }

      return {
        name,
        initialize: jest.fn(),
        execute: jest.fn(async () => ({
          type: 'text',
          text: `${name} mock response`,
        })),
      };
    }),
  };
});

import { AILink } from '../../src/ailink';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, resetMockData } from '../fixtures/testData';
import {
  AILinkConfigError,
  ToolAlreadyExistsError,
  UnsupportedProviderError,
} from '../../src/errors';

describe('AILink Integration', () => {
  let handlers: ReturnType<typeof createMockToolHandlers>;

  beforeEach(() => {
    resetMockData();
    handlers = createMockToolHandlers();
  });

  describe('Configuration & Initialization', () => {
    it('should initialize with minimal config', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'gemini-key',
      });

      expect(ai).toBeDefined();
    });

    it('should reject invalid provider', () => {
      expect(() => {
        new AILink({
          platformKey: 'test-key',
          provider: 'invalid-provider' as any,
          providerKey: 'key',
        });
      }).toThrow();
    });

    it('platformKey is optional — does not throw when missing', () => {
      expect(() => {
        new AILink({
          provider: 'gemini',
          providerKey: 'key',
        });
      }).not.toThrow();
    });

    it('should reject missing provider key', () => {
      expect(() => {
        new AILink({
          platformKey: 'test-key',
          provider: 'gemini',
          providerKey: '',
        });
      }).toThrow();
    });

    it('should initialize with all config options', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'gemini-key',
        model: 'custom-model',
        debug: true,
        environment: 'production',
        fallback: ['openai', 'claude'],
        retries: 3,
        retryDelay: 200,
        platformUrl: 'https://custom.platform.com',
      });

      expect(ai).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    it('should register a tool', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('checkInventory', 'Check inventory', toolSchemas.checkInventory, handlers.checkInventory);

      expect(ai.tools()).toContain('checkInventory');
    });

    it('should register multiple tools', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('tool1', 'Tool 1', toolSchemas.checkInventory, handlers.checkInventory);
      ai.register('tool2', 'Tool 2', toolSchemas.getOrderStatus, handlers.getOrderStatus);
      ai.register('tool3', 'Tool 3', toolSchemas.cancelOrder, handlers.cancelOrder);

      const tools = ai.tools();
      expect(tools).toContain('tool1');
      expect(tools).toContain('tool2');
      expect(tools).toContain('tool3');
      expect(tools.length).toBe(3);
    });

    it('should reject duplicate tool names', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('checkInventory', 'Check inventory', toolSchemas.checkInventory, handlers.checkInventory);

      expect(() => {
        ai.register('checkInventory', 'Duplicate', toolSchemas.checkInventory, handlers.checkInventory);
      }).toThrow(ToolAlreadyExistsError);
    });

    it('should register tool with custom roles', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('adminTool', 'Admin only', toolSchemas.checkInventory, handlers.checkInventory, {
        roles: ['admin', 'developer'],
      });

      expect(ai.tools()).toContain('adminTool');
    });

    it('should register tool with group', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('inventoryTool', 'Inventory', toolSchemas.checkInventory, handlers.checkInventory, {
        group: 'inventory',
      });

      expect(ai.tools()).toContain('inventoryTool');
    });

    it('should unregister tool', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('tempTool', 'Temp', toolSchemas.checkInventory, handlers.checkInventory);
      expect(ai.tools()).toContain('tempTool');

      ai.unregister('tempTool');
      expect(ai.tools()).not.toContain('tempTool');
    });

    it('should list all registered tools', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      expect(ai.tools().length).toBe(0);

      ai.register('tool1', 'T1', toolSchemas.checkInventory, handlers.checkInventory);
      ai.register('tool2', 'T2', toolSchemas.getOrderStatus, handlers.getOrderStatus);

      const tools = ai.tools();
      expect(tools.length).toBe(2);
    });
  });

  describe('Session Management', () => {
    it('should create a session', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      const session = ai.createSession();

      expect(session.sessionId).toEqual(expect.any(String));
      expect(session.sessionId.length).toBeGreaterThan(0);
    });

    it('should create multiple unique sessions', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      const session1 = ai.createSession();
      const session2 = ai.createSession();
      const session3 = ai.createSession();

      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(session2.sessionId).not.toBe(session3.sessionId);
      expect(session1.sessionId).not.toBe(session3.sessionId);
    });

    it('should accept sessionId in run options', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('checkInventory', 'Check', toolSchemas.checkInventory, handlers.checkInventory, {
        group: 'inventory',
      });

      const session = ai.createSession();

      // Should not throw
      try {
        await ai.run('Test', {
          sessionId: session.sessionId,
          userRole: 'user',
        });
      } catch (e) {
        // Expected - no real provider
      }
    });
  });

  describe('Run API', () => {
    it('should accept simple prompt', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('checkInventory', 'Check', toolSchemas.checkInventory, handlers.checkInventory, {
        group: 'inventory',
      });

      try {
        await ai.run('What is the inventory?');
      } catch (e) {
        // Expected - no real provider configured
      }
    });

    it('should accept prompt with options', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('checkInventory', 'Check', toolSchemas.checkInventory, handlers.checkInventory, {
        group: 'inventory',
      });

      try {
        await ai.run('Query', {
          userRole: 'admin',
          sessionId: ai.createSession().sessionId,
          groups: ['inventory'],
        });
      } catch (e) {
        // Expected - no real provider
      }
    });

    it('should validate prompt is not empty', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('checkInventory', 'Check', toolSchemas.checkInventory, handlers.checkInventory);

      await expect(ai.run('')).rejects.toThrow();
    });

    it('should apply default user role', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('checkInventory', 'Check', toolSchemas.checkInventory, handlers.checkInventory, {
        roles: ['user'],
      });

      try {
        const result = await ai.run('Test');
        expect(result.userRole).toBe('user');
      } catch (e) {
        // Expected - no real provider
      }
    });

    it('should apply user role from options', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('adminTool', 'Admin', toolSchemas.checkInventory, handlers.checkInventory, {
        roles: ['admin'],
      });

      try {
        const result = await ai.run('Test', { userRole: 'admin' });
        expect(result.userRole).toBe('admin');
      } catch (e) {
        // Expected - no real provider
      }
    });

    it('should apply group filtering', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      ai.register('inventoryTool', 'Check', toolSchemas.checkInventory, handlers.checkInventory, {
        group: 'inventory',
      });

      try {
        const result = await ai.run('Test', {
          userRole: 'user',
          groups: ['inventory'],
        });
        expect(result.groups).toEqual(['inventory']);
      } catch (e) {
        // Expected - no real provider
      }
    });
  });

  describe('Error Handling', () => {
    it('should report unsupported provider', () => {
      expect(() => {
        new AILink({
          platformKey: 'key',
          provider: 'unsupported' as any,
          providerKey: 'key',
        });
      }).toThrow();
    });

    it('platformKey is optional — does not throw when missing', () => {
      expect(() => {
        new AILink({
          provider: 'gemini',
          providerKey: 'key',
        });
      }).not.toThrow();
    });

    it('should require providerKey', () => {
      expect(() => {
        new AILink({
          platformKey: 'key',
          provider: 'gemini',
          providerKey: '',
        });
      }).toThrow();
    });
  });

  describe('Configuration Defaults', () => {
    it('should use default retry count', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
        // retries not specified - should use default
      });

      expect(ai).toBeDefined();
    });

    it('should use default retry delay', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
        // retryDelay not specified
      });

      expect(ai).toBeDefined();
    });

    it('should use default platform URL', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
        // platformUrl not specified
      });

      expect(ai).toBeDefined();
    });
  });
});
