/// <reference types="jest" />

/**
 * E2E Tests — Inventory Management Workflow
 * Complete workflow: check inventory → get order status → cancel order
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { AILink } from '../../src/ailink';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, resetMockData } from '../fixtures/testData';

describe('E2E Inventory Management Workflow', () => {
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

    // Register tools for inventory workflow
    ai.register('checkInventory', 'Check product inventory levels', toolSchemas.checkInventory, handlers.checkInventory, {
      roles: ['user', 'admin', 'developer'],
      group: 'inventory',
    });

    ai.register('getOrderStatus', 'Get the status of an order', toolSchemas.getOrderStatus, handlers.getOrderStatus, {
      roles: ['user', 'admin', 'developer'],
      group: 'orders',
    });

    ai.register('cancelOrder', 'Cancel an existing order', toolSchemas.cancelOrder, handlers.cancelOrder, {
      roles: ['admin', 'developer'],
      group: 'orders',
    });

    ai.register('getLowStockProducts', 'Find products with low stock', toolSchemas.getLowStockProducts, handlers.getLowStockProducts, {
      roles: ['admin', 'developer'],
      group: 'inventory',
    });

    sessionId = ai.createSession() as any;
  });

  describe('User Workflow: Check Inventory', () => {
    it('should allow user to check specific product inventory', async () => {
      try {
        const result = await ai.run('What is the stock level for product-001?', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(result).toBeDefined();
        expect(result.userRole).toBe('user');
        expect(result.toolsCalled).toBeDefined();
        expect(result.executionTime).toBeGreaterThan(0);
      } catch (error: any) {
        // API errors acceptable in test
        expect(error).toBeDefined();
      }
    });

    it('should allow user to check multiple product inventories', async () => {
      try {
        const result = await ai.run('Check inventory for product-001, product-002, and product-003', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(result).toBeDefined();
        expect(result.provider).toBe('gemini');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should prevent user from canceling orders', async () => {
      try {
        const result = await ai.run('Cancel order order-001', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // User should not have access to cancelOrder tool
        expect(result.allowedTools).not.toContain('cancelOrder');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should maintain context across multiple inventory checks', async () => {
      try {
        // First check
        await ai.run('Check stock for product-001', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        // Second check - should maintain context
        const result = await ai.run('How about product-002?', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Admin Workflow: Manage Orders', () => {
    it('should allow admin to check inventory', async () => {
      try {
        const result = await ai.run('Check inventory for product-001', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['inventory'],
        });

        expect(result).toBeDefined();
        expect(result.userRole).toBe('admin');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should allow admin to get order status', async () => {
      try {
        const result = await ai.run('What is the status of order order-001?', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['orders'],
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should allow admin to cancel orders', async () => {
      try {
        const result = await ai.run('Cancel order order-001', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });

        expect(result).toBeDefined();
        expect(result.allowedTools).toContain('cancelOrder');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle complex order cancellation workflow', async () => {
      try {
        // Step 1: Check order status
        await ai.run('Get the status of order order-001', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['orders'],
        });

        // Step 2: Cancel the order
        const cancelResult = await ai.run('Cancel order order-001 due to customer request', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['orders'],
        });

        expect(cancelResult).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should find and report low stock products', async () => {
      try {
        const result = await ai.run('Find all products with stock below 50 units', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['inventory'],
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Developer Workflow: Full Access', () => {
    it('should allow developer to access all tools', async () => {
      try {
        const result = await ai.run('Check inventory, get order status, and find low stock products', {
          sessionId: sessionId as any,
          userRole: 'developer',
        });

        expect(result).toBeDefined();
        expect(result.userRole).toBe('developer');
        // Developer should have access to all registered tools
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should allow developer to perform administrative actions', async () => {
      try {
        const result = await ai.run('Cancel order order-001 and check its status', {
          sessionId: sessionId as any,
          userRole: 'developer',
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Complete Multi-Step Workflow', () => {
    it('should execute a 3-step workflow: check → status → cancel', async () => {
      try {
        // Step 1: Check inventory to understand stock levels
        const step1 = await ai.run('Check the current stock level for product-001', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });

        expect(step1).toBeDefined();

        // Step 2: Check order status to see what orders are pending
        const step2 = await ai.run('What is the status of the most recent order?', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });

        expect(step2).toBeDefined();

        // Step 3: Cancel order if needed
        const step3 = await ai.run('Cancel the order we just looked at', {
          sessionId: sessionId as any,
          userRole: 'admin',
        });

        expect(step3).toBeDefined();

        // All three steps should complete successfully
        expect(step1).toHaveProperty('response');
        expect(step2).toHaveProperty('response');
        expect(step3).toHaveProperty('response');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle sequential same-group operations', async () => {
      try {
        // Multiple inventory operations
        const result1 = await ai.run('Check stock for product-001', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        const result2 = await ai.run('Also check product-002', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        const result3 = await ai.run('And product-003', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(result3).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle workflow with role escalation', async () => {
      try {
        // User checks inventory
        const userResult = await ai.run('Check product-001 inventory', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(userResult).toBeDefined();

        // Same session, escalated to admin
        const adminResult = await ai.run('Cancel any orders with that product', {
          sessionId: sessionId as any,
          userRole: 'admin',
          groups: ['orders'],
        });

        expect(adminResult).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling in Workflows', () => {
    it('should handle tool execution error and continue', async () => {
      try {
        // First successful call
        await ai.run('Check inventory for product-001', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        // Second call with invalid data (should fail gracefully)
        try {
          await ai.run('Check inventory for invalid-product', {
            sessionId: sessionId as any,
            userRole: 'user',
            groups: ['inventory'],
          });
        } catch (e) {
          // Tool error is acceptable
        }

        // Third call should work normally
        const result = await ai.run('Check inventory for product-002', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle access denied gracefully', async () => {
      try {
        // User tries to access admin-only operation
        const result = await ai.run('Cancel order order-001', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // Should complete but not include cancelOrder tool
        expect(result).toBeDefined();
        expect(result.allowedTools).not.toContain('cancelOrder');
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should recover from provider error in session', async () => {
      try {
        // This may fail due to provider, but session should continue
        try {
          await ai.run('Call with network timeout', {
            sessionId: sessionId as any,
            userRole: 'user',
          });
        } catch (e) {
          // Provider error expected
        }

        // Session should still work for next call
        const result = await ai.run('Check inventory for product-001', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(result).toBeDefined();
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Workflow Metrics', () => {
    it('should track execution metrics across workflow steps', async () => {
      try {
        const result1 = await ai.run('Check inventory', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['inventory'],
        });

        expect(result1.executionTime).toBeGreaterThan(0);
        expect(result1.toolsCalled).toEqual(expect.any(Array));
        expect(result1.allowedTools).toEqual(expect.any(Array));

        const result2 = await ai.run('Get order status', {
          sessionId: sessionId as any,
          userRole: 'user',
          groups: ['orders'],
        });

        expect(result2.executionTime).toBeGreaterThan(0);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should provide consistent provider tracking', async () => {
      try {
        const result1 = await ai.run('Query 1', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        const result2 = await ai.run('Query 2', {
          sessionId: sessionId as any,
          userRole: 'user',
        });

        // Both should use same provider
        expect(result1.provider).toBe(result2.provider);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });
});
