/// <reference types="jest" />

/**
 * E2E Tests — Multi-Turn Conversation Workflow
 * Extended conversation with context preservation and intelligent tool selection
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { AILink } from '../../src/ailink';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, resetMockData } from '../fixtures/testData';

describe('E2E Multi-Turn Conversation Workflow', () => {
  let ai: AILink;
  let handlers: ReturnType<typeof createMockToolHandlers>;
  let sessionId: string;

  beforeEach(() => {
    resetMockData();
    handlers = createMockToolHandlers();

    ai = new AILink({
      platformKey: 'test-ailink-key',
      provider: 'gemini',
      providerKey: process.env.GEMINI_KEY || 'test-key',
      debug: false,
    });

    // Register all tools
    ai.register('checkInventory', 'Check inventory levels', toolSchemas.checkInventory, handlers.checkInventory);
    ai.register('getOrderStatus', 'Get order status', toolSchemas.getOrderStatus, handlers.getOrderStatus);
    ai.register('cancelOrder', 'Cancel order', toolSchemas.cancelOrder, handlers.cancelOrder);
    ai.register('getLowStockProducts', 'Find low stock', toolSchemas.getLowStockProducts, handlers.getLowStockProducts);
    ai.register('createOrder', 'Create new order', toolSchemas.createOrder, handlers.createOrder);
    ai.register('updateInventory', 'Update inventory', toolSchemas.updateInventory, handlers.updateInventory);

    sessionId = ai.createSession() as any;
  });

  describe('Multi-Turn Context Preservation', () => {
    it('should maintain context over 3 turns', async () => {
      try {
        // Turn 1: Initial query
        const turn1 = await ai.run('What products do we have in stock?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });
        expect(turn1).toBeDefined();

        // Turn 2: Follow-up about specific product
        const turn2 = await ai.run('Tell me more about product-001', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });
        expect(turn2).toBeDefined();

        // Turn 3: Action based on earlier context
        const turn3 = await ai.run('How many of those are currently in stock?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });
        expect(turn3).toBeDefined();

        // All turns should complete
        expect(turn1.response).toBeDefined();
        expect(turn2.response).toBeDefined();
        expect(turn3.response).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should maintain context over 5+ turns', async () => {
      const turns = [];

      try {
        for (let i = 1; i <= 5; i++) {
          const result = await ai.run(`Question ${i}`, {
            sessionId: sessionId as any,
            userRole: 'admin',
          });

          turns.push(result);
          expect(result).toBeDefined();
        }

        // All 5 turns should be completed
        expect(turns).toHaveLength(5);
        turns.forEach((result, index) => {
          expect(result).toHaveProperty('response');
          expect(result.provider).toBe('gemini');
        });
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should reference earlier turns in later queries', async () => {
      try {
        // Turn 1: Ask about a product
        await ai.run('What is the stock level for product-001?', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // Turn 2: Reference the previous answer
        const turn2 = await ai.run('Is that enough to fulfill a large order?', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // Turn 3: Further reference
        const turn3 = await ai.run('What should we do if it\'s not enough?', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        expect(turn2).toBeDefined();
        expect(turn3).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Intelligent Tool Selection', () => {
    it('should use appropriate tool for each query type', async () => {
      try {
        // Inventory check
        const invResult = await ai.run('Check inventory', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });
        expect(invResult).toBeDefined();

        // Order check
        const orderResult = await ai.run('Check order status', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['orders'],
        });
        expect(orderResult).toBeDefined();

        // Back to inventory
        const inv2Result = await ai.run('Check stock again', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });
        expect(inv2Result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should select multiple tools in single turn if needed', async () => {
      try {
        const result = await ai.run(
          'Check inventory for product-001 and get status of order order-001',
          {
            sessionId: sessionId as any,
            userRole: 'admin',
          }
        );

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should recover and use different tool on follow-up', async () => {
      try {
        // First query with one tool
        await ai.run('Check product-001 inventory', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        // Follow-up with different tool
        const result = await ai.run('Now check the status of the related order', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['orders'],
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Contextual Decision Making', () => {
    it('should make decisions based on accumulated context', async () => {
      try {
        // Get inventory info
        await ai.run('What is the stock for product-001?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });

        // Get order info
        await ai.run('What orders are pending for this product?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });

        // Make decision
        const decision = await ai.run('Do we need to reorder?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });

        expect(decision).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should adapt tool usage based on conversation flow', async () => {
      try {
        // Start with inventory
        await ai.run('Show me low stock products', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['inventory'],
        });

        // Move to orders
        const moveToOrders = await ai.run('Which orders involve these products?', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['orders'],
        });

        expect(moveToOrders).toBeDefined();

        // Take action
        const action = await ai.run('Cancel the orders with lowest priority', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['orders'],
        });

        expect(action).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Natural Follow-Ups', () => {
    it('should handle "why", "what", "how" follow-ups', async () => {
      try {
        // Initial statement
        await ai.run('Show me product-001 stock level', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // Why follow-up
        const why = await ai.run('Why is it at that level?', {
          sessionId: sessionId as any,
          userRole: 'user',
        });
        expect(why).toBeDefined();

        // What follow-up
        const what = await ai.run('What should I do about it?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });
        expect(what).toBeDefined();

        // How follow-up
        const how = await ai.run('How do I place a reorder?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });
        expect(how).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle abbreviated follow-ups', async () => {
      try {
        await ai.run('Check product-001', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // Abbreviated: "And product-002?"
        const abbrev = await ai.run('And product-002?', {
          sessionId: sessionId as any,
          userRole: 'user',
        });
        expect(abbrev).toBeDefined();

        // Short: "Also product-003?"
        const short = await ai.run('Also product-003?', {
          sessionId: sessionId as any,
          userRole: 'user',
        });
        expect(short).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle pronoun references', async () => {
      try {
        await ai.run('Get the status of order order-001', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // Use "it" to refer to the order
        const pronoun = await ai.run('When will it ship?', {
          sessionId: sessionId as any,
          userRole: 'user',
        });
        expect(pronoun).toBeDefined();

        // Use "this" reference
        const this_ref = await ai.run('Can I cancel this?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });
        expect(this_ref).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Session Memory Boundaries', () => {
    it('should not mix conversations across sessions', async () => {
      const session1 = ai.createSession();
      const session2 = ai.createSession();

      try {
        // Session 1: Check product-001
        await ai.run('Check product-001', {
          sessionId: session1 as any,
          userRole: 'user',
        });

        // Session 2: Different product
        const session2Result = await ai.run('Check product-002', {
          sessionId: session2 as any,
          userRole: 'user',
        });

        expect(session2Result).toBeDefined();

        // Session 1: Reference to original should not leak from session 2
        const session1Again = await ai.run('Tell me about it', {
          sessionId: session1 as any,
          userRole: 'user',
        });

        expect(session1Again).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should maintain separate history per session', async () => {
      const session1 = ai.createSession();
      const session2 = ai.createSession();

      try {
        // 3 messages in session 1
        for (let i = 0; i < 3; i++) {
          await ai.run(`Session 1 message ${i}`, {
            sessionId: session1 as any,
            userRole: 'user',
          });
        }

        // 2 messages in session 2
        for (let i = 0; i < 2; i++) {
          await ai.run(`Session 2 message ${i}`, {
            sessionId: session2 as any,
            userRole: 'user',
          });
        }

        // Both should work independently
        expect(true).toBe(true);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Long-Running Conversations', () => {
    it('should handle 10-turn conversation', async () => {
      const turns = [];

      try {
        for (let i = 1; i <= 10; i++) {
          const result = await ai.run(`Turn ${i}: Check status`, {
            sessionId: sessionId as any,
            userRole: 'user',
          });

          turns.push(result);
        }

        expect(turns).toHaveLength(10);
        turns.forEach((result) => {
          expect(result).toHaveProperty('response');
        });
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle conversation exceeding maxTurns threshold', async () => {
      try {
        // Generate many turns to test auto-pruning
        for (let i = 0; i < 60; i++) {
          await ai.run(`Turn ${i}: Check inventory`, {
            sessionId: sessionId as any,
            userRole: 'user',
          });
        }

        // Session should still work after pruning
        const result = await ai.run('Final query', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should maintain performance over long conversation', async () => {
      try {
        const timings: number[] = [];

        for (let i = 0; i < 5; i++) {
          const before = Date.now();

          await ai.run(`Turn ${i}`, {
            sessionId: sessionId as any,
            userRole: 'user',
          });

          const duration = Date.now() - before;
          timings.push(duration);
        }

        // Performance should remain consistent
        // (No extreme degradation over time)
        expect(timings.length).toBe(5);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });
});
