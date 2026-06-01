/**
 * End-to-End Tests — Error Handling and Recovery
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { Engine } from '../../src/engine';
import { FunctionRegistry } from '../../src/registry';
import { Validator } from '../../src/validator';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, mockOrders, resetMockData } from '../fixtures/testData';
import { MockProviderAdapter } from '../integration/mockAdapter';

const createRecoveryEngine = () => {
  const registry = new FunctionRegistry();
  const handlers = createMockToolHandlers();
  const provider = new MockProviderAdapter();

  registry.register('checkInventory', 'Check inventory', toolSchemas.checkInventory, handlers.checkInventory, {
    roles: ['user', 'admin', 'developer'],
    group: 'inventory',
  });
  registry.register('cancelOrder', 'Cancel order', toolSchemas.cancelOrder, handlers.cancelOrder, {
    roles: ['admin', 'developer'],
    group: 'orders',
  });

  return {
    engine: new Engine(registry, provider, new Validator()),
    provider,
  };
};

describe('E2E Error Recovery', () => {
  beforeEach(() => {
    resetMockData();
  });

  it('should recover from invalid tool arguments and return a final response', async () => {
    const { engine, provider } = createRecoveryEngine();

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'checkInventory',
        toolArgs: { product: 'product-001' },
        callId: 'bad-args-call',
      },
      { type: 'text', text: 'I could not check inventory because the product ID was invalid.' },
    ]);

    const result = await engine.run('Check product 123', { userRole: 'user' });

    expect(result.response).toContain('invalid');
    expect(result.toolsCalled).toEqual([]);
  });

  it('should continue when a provider requests an unknown tool', async () => {
    const { engine, provider } = createRecoveryEngine();

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'deleteEverything',
        toolArgs: {},
        callId: 'unknown-call',
      },
      { type: 'text', text: 'That tool is unavailable, so no changes were made.' },
    ]);

    const result = await engine.run('Use an unavailable tool', { userRole: 'developer' });

    expect(result.response).toContain('unavailable');
    expect(result.toolsCalled).toEqual([]);
  });

  it('should preserve state when a business rule blocks a tool action', async () => {
    const { engine, provider } = createRecoveryEngine();

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'cancelOrder',
        toolArgs: { orderId: 'order-002' },
        callId: 'cancel-shipped-call',
      },
      { type: 'text', text: 'order-002 cannot be cancelled because it has already shipped.' },
    ]);

    const result = await engine.run('Cancel shipped order-002', {
      userRole: 'admin',
      groups: ['orders'],
    });

    expect(result.response).toContain('cannot be cancelled');
    expect(result.toolsCalled).toEqual(['cancelOrder']);
    expect(mockOrders['order-002'].status).toBe('shipped');
  });

  it('should allow a later request to succeed after a provider failure', async () => {
    const { engine, provider } = createRecoveryEngine();

    provider.setError(new Error('temporary provider outage'));
    await expect(engine.run('First attempt', { userRole: 'user' })).rejects.toThrow('temporary provider outage');

    provider.reset();
    provider.setResponse({ type: 'text', text: 'Recovered response.' });

    const recovered = await engine.run('Try again', { userRole: 'user' });
    expect(recovered.response).toBe('Recovered response.');
  });
});
