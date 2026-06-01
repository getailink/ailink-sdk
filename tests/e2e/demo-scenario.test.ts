/**
 * End-to-End Tests — Demo Inventory and Order Workflow
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { Engine } from '../../src/engine';
import { FunctionRegistry } from '../../src/registry';
import { Validator } from '../../src/validator';
import { toolSchemas } from '../fixtures/toolSchemas';
import {
  createMockToolHandlers,
  mockInventory,
  mockOrders,
  resetMockData,
} from '../fixtures/testData';
import { MockProviderAdapter } from '../integration/mockAdapter';

const createDemoEngine = () => {
  const registry = new FunctionRegistry();
  const handlers = createMockToolHandlers();
  const provider = new MockProviderAdapter();

  registry.register('checkInventory', 'Check product inventory', toolSchemas.checkInventory, handlers.checkInventory, {
    roles: ['user', 'admin', 'developer'],
    group: 'inventory',
  });
  registry.register('getOrderStatus', 'Get order status', toolSchemas.getOrderStatus, handlers.getOrderStatus, {
    roles: ['user', 'admin', 'developer'],
    group: 'orders',
  });
  registry.register('cancelOrder', 'Cancel a pending order', toolSchemas.cancelOrder, handlers.cancelOrder, {
    roles: ['admin', 'developer'],
    group: 'orders',
  });
  registry.register('updateInventory', 'Update inventory count', toolSchemas.updateInventory, handlers.updateInventory, {
    roles: ['admin', 'developer'],
    group: 'inventory',
  });

  return {
    engine: new Engine(registry, provider, new Validator()),
    provider,
  };
};

describe('E2E Demo Scenario', () => {
  beforeEach(() => {
    resetMockData();
  });

  it('should complete a user inventory and order lookup workflow', async () => {
    const { engine, provider } = createDemoEngine();

    provider.setResponse({
      type: 'tool_calls',
      toolCalls: [
        { toolName: 'checkInventory', toolArgs: { productId: 'product-001' }, callId: 'inventory-call' },
        { toolName: 'getOrderStatus', toolArgs: { orderId: 'order-002' }, callId: 'order-call' },
      ],
    });
    provider.setFinalResponse('product-001 has stock available and order-002 has shipped.');

    const result = await engine.run(
      'Do we have product-001 in stock, and what is the status of order-002?',
      { userRole: 'user' }
    );

    expect(result.response).toContain('order-002 has shipped');
    expect(result.toolsCalled).toEqual(expect.arrayContaining(['checkInventory', 'getOrderStatus']));
    expect(result.allowedTools).toEqual(expect.arrayContaining(['checkInventory', 'getOrderStatus']));
    expect(result.allowedTools).not.toContain('cancelOrder');
  });

  it('should complete an admin cancellation workflow and mutate order state', async () => {
    const { engine, provider } = createDemoEngine();

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'cancelOrder',
        toolArgs: { orderId: 'order-001' },
        callId: 'cancel-call',
      },
      { type: 'text', text: 'Order order-001 has been cancelled.' },
    ]);

    const result = await engine.run('Cancel order-001', {
      userRole: 'admin',
      groups: ['orders'],
    });

    expect(result.response).toContain('cancelled');
    expect(result.toolsCalled).toEqual(['cancelOrder']);
    expect(result.allowedTools).toEqual(expect.arrayContaining(['getOrderStatus', 'cancelOrder']));
    expect(mockOrders['order-001'].status).toBe('cancelled');
  });

  it('should complete a developer inventory update workflow', async () => {
    const { engine, provider } = createDemoEngine();

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'updateInventory',
        toolArgs: { productId: 'product-005', newStock: 25 },
        callId: 'update-call',
      },
      { type: 'text', text: 'product-005 inventory is now 25.' },
    ]);

    const result = await engine.run('Set product-005 stock to 25', {
      userRole: 'developer',
      groups: ['inventory'],
    });

    expect(result.response).toContain('25');
    expect(result.toolsCalled).toEqual(['updateInventory']);
    expect(mockInventory['product-005']).toBe(25);
  });
});
