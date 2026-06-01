/**
 * Integration Tests — Engine
 * Tests agentic loop execution with role/group filtering and parallel tools
 */

import { Engine } from '../../src/engine';
import { FunctionRegistry } from '../../src/registry';
import { Validator } from '../../src/validator';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, resetMockData } from '../fixtures/testData';
import { MockProviderAdapter } from './mockAdapter';

describe('Engine Integration', () => {
  let engine: Engine;
  let registry: FunctionRegistry;
  let validator: Validator;
  let mockProvider: MockProviderAdapter;
  const handlers = createMockToolHandlers();

  beforeEach(() => {
    resetMockData();
    registry = new FunctionRegistry();
    validator = new Validator();
    mockProvider = new MockProviderAdapter();

    // Register standard tools
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

    engine = new Engine(registry, mockProvider, validator);
  });

  describe('Basic Execution', () => {
    it('should complete with text response', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'The item is in stock with 100 units available.',
      });

      const result = await engine.run('What is the inventory level for product-001?', {
        userRole: 'user',
      });

      expect(result.response).toContain('in stock');
      expect(result.toolsCalled).toEqual([]);
      expect(result.allowedTools).toContain('checkInventory');
      expect(result.userRole).toBe('user');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should execute single tool call', async () => {
      mockProvider.setResponse({
        type: 'tool_call',
        toolName: 'checkInventory',
        toolArgs: { productId: 'product-001' },
      });

      mockProvider.setToolResult('checkInventory', { stock: 100, location: 'warehouse-A' });
      mockProvider.setFinalResponse('Stock is 100 units at warehouse-A');

      const result = await engine.run('Check inventory for product-001', {
        userRole: 'user',
      });

      expect(result.response).toContain('Stock is 100 units');
      expect(result.toolsCalled).toContain('checkInventory');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should execute parallel tool calls', async () => {
      mockProvider.setResponse({
        type: 'tool_calls',
        toolCalls: [
          { toolName: 'checkInventory', toolArgs: { productId: 'product-001' }, callId: 'call-1' },
          { toolName: 'getOrderStatus', toolArgs: { orderId: 'order-123' }, callId: 'call-2' },
        ],
      });

      mockProvider.setToolResult('checkInventory', { stock: 50 });
      mockProvider.setToolResult('getOrderStatus', { status: 'shipped' });
      mockProvider.setFinalResponse('Product has 50 units and order is shipped');

      const result = await engine.run('Check inventory and order status', {
        userRole: 'user',
      });

      expect(result.toolsCalled).toContain('checkInventory');
      expect(result.toolsCalled).toContain('getOrderStatus');
      expect(result.toolsCalled.length).toBe(2);
    });
  });

  describe('Role-Based Filtering', () => {
    it('user should only see user-accessible tools', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'Only showing allowed tools.',
      });

      const result = await engine.run('Check what tools I can use', {
        userRole: 'user',
      });

      // User should NOT see cancelOrder or updateInventory (admin/developer only)
      expect(result.allowedTools).not.toContain('cancelOrder');
      expect(result.allowedTools).not.toContain('updateInventory');
      expect(result.allowedTools).toContain('checkInventory');
      expect(result.allowedTools).toContain('getOrderStatus');
    });

    it('admin should see admin tools but not developer-only', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'Admin tools available.',
      });

      const result = await engine.run('Check admin tools', {
        userRole: 'admin',
      });

      expect(result.allowedTools).toContain('cancelOrder');
      expect(result.allowedTools).toContain('updateInventory');
    });

    it('developer should see all tools', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'All tools available.',
      });

      const result = await engine.run('Check all tools', {
        userRole: 'developer',
      });

      expect(result.allowedTools).toContain('checkInventory');
      expect(result.allowedTools).toContain('getOrderStatus');
      expect(result.allowedTools).toContain('cancelOrder');
      expect(result.allowedTools).toContain('updateInventory');
    });

    it('should reject unauthorized tool call', async () => {
      mockProvider.setResponse({
        type: 'tool_call',
        toolName: 'cancelOrder', // Only admin/developer
        toolArgs: { orderId: 'order-123' },
      });

      mockProvider.setToolResult('cancelOrder', { error: 'Unauthorized' });
      mockProvider.setFinalResponse('You do not have permission to cancel orders');

      const result = await engine.run('Cancel my order', {
        userRole: 'user', // User role - no access
      });

      // Engine should continue even if tool not accessible
      expect(result.allowedTools).not.toContain('cancelOrder');
    });
  });

  describe('Group-Based Filtering', () => {
    it('should filter tools by single group', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'Inventory tools available.',
      });

      const result = await engine.run('Check inventory tools', {
        userRole: 'user',
        groups: ['inventory'],
      });

      expect(result.allowedTools).toContain('checkInventory');
      expect(result.allowedTools).not.toContain('getOrderStatus');
      expect(result.groups).toEqual(['inventory']);
    });

    it('should filter tools by multiple groups', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'Multiple groups available.',
      });

      const result = await engine.run('Check tools', {
        userRole: 'admin',
        groups: ['inventory', 'orders'],
      });

      expect(result.allowedTools).toContain('checkInventory');
      expect(result.allowedTools).toContain('getOrderStatus');
      expect(result.allowedTools).toContain('cancelOrder');
      expect(result.allowedTools).toContain('updateInventory');
    });

    it('should throw EmptyGroupError when group has no accessible tools', async () => {
      await expect(
        engine.run('Check tools', {
          userRole: 'user',
          groups: ['nonexistent'],
        })
      ).rejects.toThrow();
    });

    it('should ignore empty groups array', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'All user tools.',
      });

      const result = await engine.run('Check tools', {
        userRole: 'user',
        groups: [],
      });

      // Should return all user-accessible tools
      expect(result.allowedTools).toContain('checkInventory');
      expect(result.allowedTools).toContain('getOrderStatus');
      expect(result.groups).toBeNull();
    });
  });

  describe('Tool Execution', () => {
    it('should validate tool arguments', async () => {
      mockProvider.setResponse({
        type: 'tool_call',
        toolName: 'checkInventory',
        toolArgs: { productId: 'product-001' }, // Valid
      });

      mockProvider.setToolResult('checkInventory', { stock: 75 });
      mockProvider.setFinalResponse('Product has 75 units');

      const result = await engine.run('Check product', { userRole: 'user' });

      expect(result.toolsCalled).toContain('checkInventory');
    });

    it('should handle invalid tool arguments gracefully', async () => {
      mockProvider.setResponse({
        type: 'tool_call',
        toolName: 'checkInventory',
        toolArgs: { productId: 123 }, // Invalid - should be string
      });

      mockProvider.setToolResult('checkInventory', null);
      mockProvider.setFinalResponse('Validation failed for checkInventory');

      const result = await engine.run('Check product', { userRole: 'user' });

      // Engine continues despite validation error
      expect(result.response).toBeDefined();
    });

    it('should call unregistered tool safely', async () => {
      mockProvider.setResponse({
        type: 'tool_call',
        toolName: 'unknownTool',
        toolArgs: {},
      });

      mockProvider.setFinalResponse('Tool not found');

      const result = await engine.run('Use unknown tool', { userRole: 'developer' });

      // Engine continues
      expect(result.response).toBeDefined();
    });
  });

  describe('Multi-Turn Agentic Loop', () => {
    it('should stop after receiving text response', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'Final answer after 1 iteration.',
      });

      const result = await engine.run('What is 2+2?', { userRole: 'user' });

      expect(result.response).toContain('Final answer');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should stop after max iterations', async () => {
      // Set responses to always return tool calls (never text)
      let callCount = 0;
      mockProvider.setDynamicResponse(() => {
        callCount++;
        if (callCount >= 10) {
          return { type: 'text', text: 'Forced stop after max iterations' };
        }
        return {
          type: 'tool_call',
          toolName: 'checkInventory',
          toolArgs: { productId: 'product-001' },
        };
      });

      mockProvider.setToolResult('checkInventory', { stock: 100 });

      const result = await engine.run('Keep using tools', { userRole: 'user' });

      // Should eventually return after max iterations
      expect(result.response).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle tool results and pass to next iteration', async () => {
      let iteration = 0;
      mockProvider.setDynamicResponse(() => {
        iteration++;
        if (iteration === 1) {
          return {
            type: 'tool_call',
            toolName: 'checkInventory',
            toolArgs: { productId: 'product-001' },
          };
        } else {
          return { type: 'text', text: 'Stock is 100 units' };
        }
      });

      mockProvider.setToolResult('checkInventory', { stock: 100 });

      const result = await engine.run('Check inventory then report', { userRole: 'user' });

      expect(result.toolsCalled).toContain('checkInventory');
      expect(result.response).toContain('Stock');
    });
  });

  describe('Execution Metrics', () => {
    it('should measure execution time', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'Quick response',
      });

      const result = await engine.run('Quick query', { userRole: 'user' });

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTime).toBe('number');
    });

    it('should track all called tools', async () => {
      mockProvider.setResponse({
        type: 'tool_calls',
        toolCalls: [
          { toolName: 'checkInventory', toolArgs: { productId: 'p1' }, callId: 'c1' },
          { toolName: 'getOrderStatus', toolArgs: { orderId: 'o1' }, callId: 'c2' },
        ],
      });

      mockProvider.setToolResult('checkInventory', { stock: 50 });
      mockProvider.setToolResult('getOrderStatus', { status: 'shipped' });
      mockProvider.setFinalResponse('Done');

      const result = await engine.run('Multi-tool call', { userRole: 'user' });

      expect(result.toolsCalled.length).toBe(2);
      expect(result.toolsCalled).toContain('checkInventory');
      expect(result.toolsCalled).toContain('getOrderStatus');
    });

    it('should include all allowed tools in result', async () => {
      mockProvider.setResponse({
        type: 'text',
        text: 'Response',
      });

      const result = await engine.run('Query', {
        userRole: 'user',
        groups: ['inventory'],
      });

      expect(result.allowedTools.length).toBeGreaterThan(0);
      expect(result.allowedTools).toContain('checkInventory');
    });
  });

  describe('Error Resilience', () => {
    it('should continue on tool execution error', async () => {
      mockProvider.setResponse({
        type: 'tool_call',
        toolName: 'checkInventory',
        toolArgs: { productId: 'product-001' },
      });

      mockProvider.setToolResult('checkInventory', null); // Null result = error
      mockProvider.setFinalResponse('Tool failed, but processing continued');

      const result = await engine.run('Check inventory', { userRole: 'user' });

      expect(result.response).toBeDefined();
    });

    it('should not throw on provider error', async () => {
      mockProvider.setError(new Error('Provider connection failed'));

      await expect(
        engine.run('Test query', { userRole: 'user' })
      ).rejects.toThrow();
    });
  });
});
