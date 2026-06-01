/**
 * End-to-End Tests — Role and Group Filtering
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { Engine } from '../../src/engine';
import { EmptyGroupError } from '../../src/errors';
import { FunctionRegistry } from '../../src/registry';
import { Validator } from '../../src/validator';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, mockInventory, resetMockData } from '../fixtures/testData';
import { MockProviderAdapter } from '../integration/mockAdapter';

const createRoleEngine = () => {
  const registry = new FunctionRegistry();
  const handlers = createMockToolHandlers();
  const provider = new MockProviderAdapter();

  registry.register('checkInventory', 'Check inventory', toolSchemas.checkInventory, handlers.checkInventory, {
    roles: ['user', 'admin', 'developer'],
    group: 'inventory',
  });
  registry.register('getOrderStatus', 'Get order status', toolSchemas.getOrderStatus, handlers.getOrderStatus, {
    roles: ['user', 'admin', 'developer'],
    group: 'orders',
  });
  registry.register('cancelOrder', 'Cancel order', toolSchemas.cancelOrder, handlers.cancelOrder, {
    roles: ['admin', 'developer'],
    group: 'orders',
  });
  registry.register('updateInventory', 'Update inventory', toolSchemas.updateInventory, handlers.updateInventory, {
    roles: ['admin', 'developer'],
    group: 'inventory',
  });

  return {
    engine: new Engine(registry, provider, new Validator()),
    provider,
  };
};

describe('E2E Role and Group Filtering', () => {
  beforeEach(() => {
    resetMockData();
  });

  it('should expose only user-safe tools to a user', async () => {
    const { engine, provider } = createRoleEngine();

    provider.setResponse({ type: 'text', text: 'User tools are available.' });

    const result = await engine.run('What can I do?', { userRole: 'user' });

    expect(result.allowedTools).toEqual(['checkInventory', 'getOrderStatus']);
    expect(result.userRole).toBe('user');
  });

  it('should prevent filtered-out tools from mutating state', async () => {
    const { engine, provider } = createRoleEngine();

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'updateInventory',
        toolArgs: { productId: 'product-001', newStock: 0 },
        callId: 'blocked-update',
      },
      { type: 'text', text: 'Inventory update was not allowed for this user.' },
    ]);

    const result = await engine.run('Set product-001 stock to zero', {
      userRole: 'user',
      groups: ['inventory'],
    });

    expect(result.response).toContain('not allowed');
    expect(result.toolsCalled).toEqual([]);
    expect(result.allowedTools).toEqual(['checkInventory']);
    expect(mockInventory['product-001']).toBe(45);
  });

  it('should filter admin tools by selected group', async () => {
    const { engine, provider } = createRoleEngine();

    provider.setResponse({ type: 'text', text: 'Order tools only.' });

    const result = await engine.run('Show order actions', {
      userRole: 'admin',
      groups: ['orders'],
    });

    expect(result.allowedTools).toEqual(['getOrderStatus', 'cancelOrder']);
    expect(result.groups).toEqual(['orders']);
  });

  it('should expose all tools to a developer when no groups are selected', async () => {
    const { engine, provider } = createRoleEngine();

    provider.setResponse({ type: 'text', text: 'Developer tools are available.' });

    const result = await engine.run('Show everything', { userRole: 'developer' });

    expect(result.allowedTools).toEqual([
      'checkInventory',
      'getOrderStatus',
      'cancelOrder',
      'updateInventory',
    ]);
  });

  it('should fail clearly when the selected group has no accessible tools', async () => {
    const { engine } = createRoleEngine();

    await expect(
      engine.run('Show billing tools', {
        userRole: 'user',
        groups: ['billing'],
      })
    ).rejects.toThrow(EmptyGroupError);
  });
});
