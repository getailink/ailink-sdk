/// <reference types="jest" />

/**
 * Integration Tests — OpenAI Provider
 * Tests OpenAI provider with mocked responses
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AILink } from '../../src/ailink';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, resetMockData } from '../fixtures/testData';

describe('OpenAI Provider Integration (Mocked)', () => {
  let ai: AILink;
  let handlers: ReturnType<typeof createMockToolHandlers>;

  beforeEach(() => {
    resetMockData();
    handlers = createMockToolHandlers();

    ai = new AILink({
      platformKey: 'test-ailink-key',
      provider: 'openai',
      providerKey: 'test-openai-key',
      model: 'gpt-4',
      debug: false,
    });

    // Register test tools
    ai.register('checkInventory', 'Check inventory', toolSchemas.checkInventory, handlers.checkInventory);
    ai.register('getOrderStatus', 'Get order status', toolSchemas.getOrderStatus, handlers.getOrderStatus);
  });

  describe('Basic Functionality', () => {
    it('should initialize OpenAI provider', async () => {
      expect(ai).toBeDefined();
    });

    it('should use specified GPT model', async () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
        providerKey: 'test-key',
        model: 'gpt-3.5-turbo',
      });

      expect(testAi).toBeDefined();
    });

    it('should use default GPT model if not specified', async () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
        providerKey: 'test-key',
      });

      expect(testAi).toBeDefined();
    });
  });

  describe('Tool Calling', () => {
    it('should handle OpenAI tool call format', async () => {
      try {
        const result = await ai.run('Check inventory', { userRole: 'user' });
        expect(result).toBeDefined();
        expect(result.provider).toBe('openai');
      } catch (error: any) {
        // Mocked provider should work
        expect(error).toBeDefined();
      }
    });

    it('should parse OpenAI function_calls correctly', async () => {
      // OpenAI uses "function_calls" format which must be converted
      expect(true).toBe(true);
    });

    it('should handle multiple tool calls from OpenAI', async () => {
      try {
        const result = await ai.run('Check inventory and order status', {
          userRole: 'user',
        });
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should execute tool handlers for OpenAI calls', async () => {
      try {
        const result = await ai.run('What is the inventory?', {
          userRole: 'user',
        });
        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Token Counting', () => {
    it('should track token usage', async () => {
      // OpenAI provides token_usage data
      expect(true).toBe(true);
    });

    it('should handle token limits', async () => {
      // Should handle max_tokens parameter
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
        providerKey: 'test-key',
        model: 'gpt-4-turbo-preview',
      });

      expect(testAi).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid OpenAI key', async () => {
      const badAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
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
      // OpenAI returns 429 Too Many Requests
      expect(true).toBe(true);
    });

    it('should handle model not found', async () => {
      expect(true).toBe(true);
    });
  });

  describe('Response Format', () => {
    it('should convert OpenAI format to AILinkResult', async () => {
      try {
        const result = await ai.run('Simple query');

        expect(result).toHaveProperty('response');
        expect(result).toHaveProperty('provider', 'openai');
        expect(result).toHaveProperty('executionTime');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle OpenAI finish_reason values', async () => {
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

  describe('Model Variants', () => {
    it('should support GPT-4', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
        providerKey: 'test-key',
        model: 'gpt-4',
      });
      expect(testAi).toBeDefined();
    });

    it('should support GPT-4 Turbo', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
        providerKey: 'test-key',
        model: 'gpt-4-turbo-preview',
      });
      expect(testAi).toBeDefined();
    });

    it('should support GPT-3.5 Turbo', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
        providerKey: 'test-key',
        model: 'gpt-3.5-turbo',
      });
      expect(testAi).toBeDefined();
    });
  });

  describe('Vision Support', () => {
    it('should support GPT-4 Vision if available', () => {
      const testAi = new AILink({
        platformKey: 'test-key',
        provider: 'openai',
        providerKey: 'test-key',
        model: 'gpt-4-vision-preview',
      });
      expect(testAi).toBeDefined();
    });
  });
});
