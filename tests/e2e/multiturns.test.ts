/**
 * End-to-End Tests — Multi-Turn Conversations with Sessions
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { Engine } from '../../src/engine';
import { FunctionRegistry } from '../../src/registry';
import { AILinkSession } from '../../src/session';
import { RunOptions } from '../../src/types';
import { Validator } from '../../src/validator';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, mockOrders, resetMockData } from '../fixtures/testData';
import { MockProviderAdapter } from '../integration/mockAdapter';

const createSessionWorkflow = (sessionId = 'e2e-session') => {
  const registry = new FunctionRegistry();
  const handlers = createMockToolHandlers();
  const provider = new MockProviderAdapter();

  registry.register('getOrderStatus', 'Get order status', toolSchemas.getOrderStatus, handlers.getOrderStatus, {
    roles: ['user', 'admin', 'developer'],
    group: 'orders',
  });
  registry.register('cancelOrder', 'Cancel order', toolSchemas.cancelOrder, handlers.cancelOrder, {
    roles: ['admin', 'developer'],
    group: 'orders',
  });

  const engine = new Engine(registry, provider, new Validator());
  const runCalls: Array<{ prompt: string; options?: RunOptions }> = [];
  const session = new AILinkSession((prompt, options) => {
    runCalls.push({ prompt, options });
    return engine.run(prompt, options);
  }, sessionId, 3);

  return { provider, session, runCalls };
};

describe('E2E Multi-Turn Sessions', () => {
  beforeEach(() => {
    resetMockData();
  });

  it('should preserve successful conversation turns in one session', async () => {
    const { provider, session } = createSessionWorkflow('orders-session');

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'getOrderStatus',
        toolArgs: { orderId: 'order-001' },
        callId: 'status-call',
      },
      { type: 'text', text: 'order-001 is pending.' },
      {
        type: 'tool_call',
        toolName: 'cancelOrder',
        toolArgs: { orderId: 'order-001' },
        callId: 'cancel-call',
      },
      { type: 'text', text: 'I cancelled order-001.' },
    ]);

    const first = await session.run('What is the status of order-001?', {
      userRole: 'admin',
      groups: ['orders'],
    });
    const second = await session.run('Cancel that pending order.', {
      userRole: 'admin',
      groups: ['orders'],
    });

    expect(first.response).toContain('pending');
    expect(second.response).toContain('cancelled');
    expect(session.sessionId).toBe('orders-session');
    expect(session.turns).toBe(2);
    expect(session.getHistory()).toEqual([
      { role: 'user', content: 'What is the status of order-001?' },
      { role: 'assistant', content: 'order-001 is pending.' },
      { role: 'user', content: 'Cancel that pending order.' },
      { role: 'assistant', content: 'I cancelled order-001.' },
    ]);
    expect(mockOrders['order-001'].status).toBe('cancelled');
  });

  it('should forward the same sessionId and per-turn role/group options across turns', async () => {
    const { provider, session, runCalls } = createSessionWorkflow('stable-session');

    provider.setCallSequence([
      { type: 'text', text: 'First admin response.' },
      { type: 'text', text: 'Second admin response.' },
    ]);

    await session.run('First admin turn', {
      userRole: 'admin',
      groups: ['orders'],
    });
    await session.run('Second admin turn', {
      userRole: 'admin',
      groups: ['orders'],
    });

    expect(runCalls).toEqual([
      {
        prompt: 'First admin turn',
        options: {
          sessionId: 'stable-session',
          userRole: 'admin',
          groups: ['orders'],
          conversationHistory: [],
        },
      },
      {
        prompt: 'Second admin turn',
        options: {
          sessionId: 'stable-session',
          userRole: 'admin',
          groups: ['orders'],
          conversationHistory: [
            { role: 'user', content: 'First admin turn' },
            { role: 'assistant', content: 'First admin response.' },
          ],
        },
      },
    ]);
    expect(session.turns).toBe(2);
  });

  it('should keep applying role and group filtering on every session turn', async () => {
    const { provider, session } = createSessionWorkflow('role-group-session');

    provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'cancelOrder',
        toolArgs: { orderId: 'order-001' },
        callId: 'blocked-user-cancel',
      },
      { type: 'text', text: 'Users cannot cancel orders.' },
      {
        type: 'tool_call',
        toolName: 'cancelOrder',
        toolArgs: { orderId: 'order-001' },
        callId: 'allowed-admin-cancel',
      },
      { type: 'text', text: 'Admin cancelled order-001.' },
    ]);

    const userResult = await session.run('Try to cancel order-001 as user', {
      userRole: 'user',
      groups: ['orders'],
    });
    expect(userResult.toolsCalled).toEqual([]);
    expect(userResult.allowedTools).toEqual(['getOrderStatus']);
    expect(mockOrders['order-001'].status).toBe('pending');

    const adminResult = await session.run('Cancel order-001 as admin', {
      userRole: 'admin',
      groups: ['orders'],
    });

    expect(adminResult.toolsCalled).toEqual(['cancelOrder']);
    expect(adminResult.allowedTools).toEqual(['getOrderStatus', 'cancelOrder']);
    expect(mockOrders['order-001'].status).toBe('cancelled');
    expect(session.turns).toBe(2);
  });

  it('should not append failed provider turns to session history', async () => {
    const { provider, session } = createSessionWorkflow('failed-turn-session');

    provider.setError(new Error('provider unavailable'));

    await expect(
      session.run('This turn fails', {
        userRole: 'admin',
        groups: ['orders'],
      })
    ).rejects.toThrow('provider unavailable');

    expect(session.turns).toBe(0);
    expect(session.getHistory()).toEqual([]);

    provider.reset();
    provider.setResponse({ type: 'text', text: 'Recovered session response.' });

    await expect(session.run('Recovered turn')).resolves.toMatchObject({
      response: 'Recovered session response.',
    });
    expect(session.getHistory()).toEqual([
      { role: 'user', content: 'Recovered turn' },
      { role: 'assistant', content: 'Recovered session response.' },
    ]);
  });

  it('should clear session history while preserving the same sessionId for future turns', async () => {
    const { provider, session, runCalls } = createSessionWorkflow('clearable-session');

    provider.setCallSequence([
      { type: 'text', text: 'Before clear.' },
      { type: 'text', text: 'After clear.' },
    ]);

    await session.run('Remember this');
    expect(session.turns).toBe(1);

    session.clearHistory();

    expect(session.sessionId).toBe('clearable-session');
    expect(session.turns).toBe(0);
    expect(session.getHistory()).toEqual([]);

    await session.run('Start fresh');

    expect(runCalls.map(call => call.options?.sessionId)).toEqual([
      'clearable-session',
      'clearable-session',
    ]);
    expect(session.getHistory()).toEqual([
      { role: 'user', content: 'Start fresh' },
      { role: 'assistant', content: 'After clear.' },
    ]);
  });

  it('should keep independent sessions isolated from each other', async () => {
    const workflowA = createSessionWorkflow('session-a');
    const workflowB = createSessionWorkflow('session-b');

    workflowA.provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'cancelOrder',
        toolArgs: { orderId: 'order-001' },
        callId: 'cancel-a',
      },
      { type: 'text', text: 'Session A cancelled order-001.' },
    ]);
    workflowB.provider.setCallSequence([
      {
        type: 'tool_call',
        toolName: 'getOrderStatus',
        toolArgs: { orderId: 'order-002' },
        callId: 'status-b',
      },
      { type: 'text', text: 'Session B saw order-002 as shipped.' },
    ]);

    const resultA = await workflowA.session.run('Cancel order-001', {
      userRole: 'admin',
      groups: ['orders'],
    });
    const resultB = await workflowB.session.run('Check order-002', {
      userRole: 'user',
      groups: ['orders'],
    });

    expect(resultA.toolsCalled).toEqual(['cancelOrder']);
    expect(resultB.toolsCalled).toEqual(['getOrderStatus']);
    expect(workflowA.session.getHistory()).toEqual([
      { role: 'user', content: 'Cancel order-001' },
      { role: 'assistant', content: 'Session A cancelled order-001.' },
    ]);
    expect(workflowB.session.getHistory()).toEqual([
      { role: 'user', content: 'Check order-002' },
      { role: 'assistant', content: 'Session B saw order-002 as shipped.' },
    ]);
    expect(workflowA.runCalls[0].options?.sessionId).toBe('session-a');
    expect(workflowB.runCalls[0].options?.sessionId).toBe('session-b');
    expect(mockOrders['order-001'].status).toBe('cancelled');
    expect(mockOrders['order-002'].status).toBe('shipped');
  });

  it('should prune old session history while keeping recent turns', async () => {
    const { provider, session } = createSessionWorkflow('pruning-session');

    provider.setCallSequence([
      { type: 'text', text: 'Turn 1 answer' },
      { type: 'text', text: 'Turn 2 answer' },
      { type: 'text', text: 'Turn 3 answer' },
      { type: 'text', text: 'Turn 4 answer' },
    ]);

    await session.run('Turn 1');
    await session.run('Turn 2');
    await session.run('Turn 3');
    await session.run('Turn 4');

    expect(session.turns).toBe(3);
    expect(session.getHistory()).toEqual([
      { role: 'user', content: 'Turn 2' },
      { role: 'assistant', content: 'Turn 2 answer' },
      { role: 'user', content: 'Turn 3' },
      { role: 'assistant', content: 'Turn 3 answer' },
      { role: 'user', content: 'Turn 4' },
      { role: 'assistant', content: 'Turn 4 answer' },
    ]);
  });
});
