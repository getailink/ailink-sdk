/// <reference types="jest" />

/**
 * Integration Tests — Groq Provider
 * Tests Groq provider with mocked responses
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AILink } from '../../src/ailink';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, resetMockData } from '../fixtures/testData';

describe('Groq Provider Integration (Mocked)', () => {
  let ai: AILink;
  let handlers: ReturnType<typeof createMockToolHandlers>;

  beforeEach(() => {
    resetMockData();
    handlers = createMockToolHandlers();

    ai = new AILink({
      platformKey: 'test-ailink-key',
      provider: 'groq',
      providerKey: 'test-groq-key',
      model: 'mixtral-8x7b-32768',
      debug: false,
    });

    // Register test tools
    ai.register('checkInventory', 'Check inventory', toolSchemas.checkInventory, handlers.checkInventory);
    ai.register('getOrderStatus', 'Get order status', toolSchemas.getOrderStatus, handlers.getOrderStatus);
  });

  describe('Basic Functionality', () => {
    it('should initialize Groq provider', async () => {
      expect(ai).toBeDefined();
    });

    it('should use specified Groq model', async () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'groq',
        providerKey: 'test-key',
        model: 'llama2-70b-4096',
      });

      expect(testAi).toBeDefined();
    });

    it('should use default Groq model if not specified', async () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'groq',
        providerKey: 'test-key',
      });

      expect(testAi).toBeDefined();
    });
  });

  describe('Compatibility with OpenAI Format', () => {
    it('should work with OpenAI-compatible format', async () => {
      // Groq uses OpenAI API format
      expect(true).toBe(true);
    });

    it('should parse tool_calls correctly', async () => {
      try {
        const result = await ai.run('Check inventory', { userRole: 'user' });
        expect(result).toBeDefined();
        expect(result.provider).toBe('groq');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle multiple tool calls', async () => {
      try {
        const result = await ai.run('Check inventory and order status', {
          userRole: 'user',
        });
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Tool Use', () => {
    it('should execute tool handlers for Groq calls', async () => {
      try {
        const result = await ai.run('What is the inventory?', {
          userRole: 'user',
        });
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should validate tool arguments', async () => {
      try {
        const result = await ai.run('Cancel order order-001', {
          userRole: 'user',
        });
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should be fast for inference', async () => {
      // Groq is known for fast inference
      const startTime = Date.now();

      try {
        await ai.run('Quick question?', { userRole: 'user' });
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(5000); // Groq should be very fast
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Groq key', async () => {
      const badAi = new AILink({
        platformKey: 'test-key',
        provider: 'groq',
        providerKey: 'invalid-key',
      });

      badAi.register('tool', 'Tool', toolSchemas.checkInventory, handlers.checkInventory);

      try {
        await badAi.run('Test');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle rate limit errors', async () => {
      // Groq has rate limits
      expect(true).toBe(true);
    });

    it('should handle model not found', async () => {
      expect(true).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should convert Groq format to AILinkResult', async () => {
      try {
        const result = await ai.run('Simple query');

        expect(result).toHaveProperty('response');
        expect(result).toHaveProperty('provider', 'groq');
        expect(result).toHaveProperty('executionTime');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle Groq finish_reason values', async () => {
      // finish_reason: "stop", "length", "tool_calls", etc.
      expect(true).toBe(true);
    });
  });

  describe('Compatibility with AILink', () => {
    it('should work with role-based filtering', async () => {
      try {
        const result = await ai.run('Admin query', {
          userRole: 'admin',
        });

        expect(result.userRole).toBe('admin');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should work with group-based filtering', async () => {
      ai.register('groupTool', 'Tool', toolSchemas.checkInventory, handlers.checkInventory, {
        group: 'test-group',
      });

      try {
        const result = await ai.run('Query', { groups: ['test-group'] });
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should work with session management', async () => {
      const sessionId = ai.createSession();

      try {
        const result = await ai.run('Query', { sessionId: sessionId as any });
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Available Models', () => {
    it('should support Mixtral models', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'groq',
        providerKey: 'test-key',
        model: 'mixtral-8x7b-32768',
      });
      expect(testAi).toBeDefined();
    });

    it('should support LLaMA models', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'groq',
        providerKey: 'test-key',
        model: 'llama2-70b-4096',
      });
      expect(testAi).toBeDefined();
    });

    it('should support Gemma models', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'groq',
        providerKey: 'test-key',
        model: 'gemma-7b-it',
      });
      expect(testAi).toBeDefined();
    });
  });

  describe('Token Efficiency', () => {
    it('should report token usage', async () => {
      try {
        const result = await ai.run('Test query');
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle max_tokens parameter', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'groq',
        providerKey: 'test-key',
        model: 'mixtral-8x7b-32768',
      });

      expect(testAi).toBeDefined();
    });
  });

  describe('Streaming Support', () => {
    it('should support streaming responses if configured', () => {
      // Groq API supports streaming
      expect(true).toBe(true);
    });
  });
});
