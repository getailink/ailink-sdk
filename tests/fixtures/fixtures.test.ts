import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  adaptClaudeResponse,
  adaptGroqResponse,
  adaptOpenAIResponse,
  claudeMockResponses,
  claudeToolDef,
  geminiToolDef,
  groqMockResponses,
  openaiMockResponses,
  openaiToolDef,
} from './mockProviderResponses';
import {
  cancelSchema,
  inventorySchema,
  lowStockSchema,
  orderSchema,
  toolSchemas,
} from './toolSchemas';
import {
  createMockToolHandlers,
  mockCustomers,
  mockErrorMessages,
  mockInventory,
  mockOrders,
  mockPrompts,
  mockResponses,
  mockUsers,
  resetMockData,
} from './testData';

describe('Fixture Test Data', () => {
  beforeEach(() => {
    resetMockData();
  });

  it('should expose stable mock inventory, orders, customers, prompts, responses, users, and errors', () => {
    expect(mockInventory).toMatchObject({
      'product-001': 45,
      'product-002': 0,
      'product-005': 3,
    });
    expect(mockOrders['order-001']).toMatchObject({
      status: 'pending',
      product: 'product-001',
      customerId: 'cust-001',
    });
    expect(mockCustomers['cust-001']).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
    });
    expect(mockPrompts.multiTool).toContain('order-002');
    expect(mockResponses.orderShipped).toEqual({ orderId: 'order-002', status: 'shipped' });
    expect(mockUsers.developer).toEqual({ role: 'developer', id: 'dev-1' });
    expect(mockErrorMessages.insufficientStock).toBe('Insufficient stock available');
  });

  it('should check inventory and report missing products', async () => {
    const handlers = createMockToolHandlers();

    await expect(handlers.checkInventory({ productId: 'product-001' })).resolves.toEqual({
      productId: 'product-001',
      stock: 45,
      inStock: true,
    });
    await expect(handlers.checkInventory({ productId: 'unknown-product' })).resolves.toEqual({
      error: 'Product unknown-product not found',
    });
  });

  it('should get order status and handle missing orders', async () => {
    const handlers = createMockToolHandlers();

    await expect(handlers.getOrderStatus({ orderId: 'order-002' })).resolves.toMatchObject({
      orderId: 'order-002',
      status: 'shipped',
      customerId: 'cust-002',
    });
    await expect(handlers.getOrderStatus({ orderId: 'missing-order' })).resolves.toEqual({
      error: 'Order missing-order not found',
    });
  });

  it('should mutate pending orders on cancel and reject shipped orders', async () => {
    const handlers = createMockToolHandlers();

    await expect(handlers.cancelOrder({ orderId: 'order-001' })).resolves.toEqual({
      success: true,
      message: 'Order order-001 cancelled',
    });
    expect(mockOrders['order-001'].status).toBe('cancelled');

    await expect(handlers.cancelOrder({ orderId: 'order-002' })).resolves.toEqual({
      error: 'Cannot cancel shipped order',
    });
    expect(mockOrders['order-002'].status).toBe('shipped');
  });

  it('should update inventory and report low-stock products', async () => {
    const handlers = createMockToolHandlers();

    await expect(handlers.updateInventory({ productId: 'product-005', newStock: 25 })).resolves.toEqual({
      productId: 'product-005',
      stock: 25,
      inStock: true,
    });
    expect(mockInventory['product-005']).toBe(25);

    await expect(handlers.getLowStockProducts({ threshold: 10 })).resolves.toEqual({
      lowStockProducts: [{ productId: 'product-002', stock: 0 }],
      count: 1,
    });
  });

  it('should create valid orders and reject invalid order requests', async () => {
    const handlers = createMockToolHandlers();
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);

    await expect(
      handlers.createOrder({ productId: 'product-001', quantity: 5, customerId: 'cust-001' })
    ).resolves.toEqual({
      success: true,
      orderId: 'order-1234567890',
    });
    expect(mockOrders['order-1234567890']).toMatchObject({
      status: 'pending',
      product: 'product-001',
      qty: 5,
      customerId: 'cust-001',
    });
    expect(mockInventory['product-001']).toBe(40);

    await expect(
      handlers.createOrder({ productId: 'missing-product', quantity: 1, customerId: 'cust-001' })
    ).resolves.toEqual({ error: 'Product not found' });
    await expect(
      handlers.createOrder({ productId: 'product-001', quantity: 0, customerId: 'cust-001' })
    ).resolves.toEqual({ error: 'Invalid quantity' });
    await expect(
      handlers.createOrder({ productId: 'product-001', quantity: 1, customerId: 'missing-customer' })
    ).resolves.toEqual({ error: 'Customer not found' });
    await expect(
      handlers.createOrder({ productId: 'product-002', quantity: 1, customerId: 'cust-001' })
    ).resolves.toEqual({ error: 'Product not found' });
  });

  it('should reset mutated inventory and orders to the baseline dataset', async () => {
    const handlers = createMockToolHandlers();

    await handlers.cancelOrder({ orderId: 'order-001' });
    await handlers.updateInventory({ productId: 'product-005', newStock: 25 });
    mockOrders['temporary-order'] = { status: 'pending' };

    resetMockData();

    expect(mockInventory['product-005']).toBe(3);
    expect(mockOrders['order-001'].status).toBe('pending');
    expect(mockOrders['temporary-order']).toBeUndefined();
  });
});

describe('Fixture Tool Schemas', () => {
  it('should expose aliases that point to the canonical tool schemas', () => {
    expect(inventorySchema).toBe(toolSchemas.checkInventory);
    expect(orderSchema).toBe(toolSchemas.getOrderStatus);
    expect(cancelSchema).toBe(toolSchemas.cancelOrder);
    expect(lowStockSchema).toBe(toolSchemas.getLowStockProducts);
  });

  it('should define required fields and constraints for primary tool schemas', () => {
    expect(toolSchemas.checkInventory).toMatchObject({
      type: 'object',
      required: ['productId'],
      properties: {
        productId: { type: 'string' },
      },
    });
    expect(toolSchemas.getOrderStatus.required).toEqual(['orderId']);
    expect(toolSchemas.cancelOrder.required).toEqual(['orderId']);
    expect(toolSchemas.createOrder.required).toEqual(['productId', 'quantity', 'customerId']);
    expect(toolSchemas.createOrder.properties.quantity).toMatchObject({ type: 'number', minimum: 1 });
    expect(toolSchemas.updateInventory.properties.newStock).toMatchObject({ type: 'number', minimum: 0 });
  });

  it('should include optional and nested schemas used by broader tests', () => {
    expect('required' in toolSchemas.getLowStockProducts).toBe(false);
    expect(toolSchemas.noParams).toEqual({ type: 'object', properties: {} });
    expect(toolSchemas.complex.properties.filters.properties.status).toEqual({
      type: 'array',
      items: { type: 'string' },
    });
    expect(toolSchemas.complex.properties.pagination.properties.limit).toMatchObject({
      type: 'number',
      minimum: 1,
      maximum: 100,
    });
  });
});

describe('Fixture Provider Mock Responses', () => {
  it('should build and adapt OpenAI text responses', () => {
    const response = openaiMockResponses.textResponse('OpenAI final answer');

    expect(adaptOpenAIResponse(response)).toEqual({
      type: 'text',
      text: 'OpenAI final answer',
    });
  });

  it('should build and adapt OpenAI single and parallel tool calls', () => {
    const single = openaiMockResponses.singleToolCall('checkInventory', { productId: 'product-001' });
    const parallel = openaiMockResponses.parallelToolCalls([
      { name: 'checkInventory', args: { productId: 'product-001' } },
      { name: 'getOrderStatus', args: { orderId: 'order-002' } },
    ]);

    expect(adaptOpenAIResponse(single)).toEqual({
      type: 'tool_call',
      toolName: 'checkInventory',
      toolArgs: { productId: 'product-001' },
      callId: 'call_abc123',
    });
    expect(adaptOpenAIResponse(parallel)).toEqual({
      type: 'tool_calls',
      toolCalls: [
        { toolName: 'checkInventory', toolArgs: { productId: 'product-001' }, callId: 'call_0' },
        { toolName: 'getOrderStatus', toolArgs: { orderId: 'order-002' }, callId: 'call_1' },
      ],
    });
  });

  it('should build and adapt Claude text, single tool, and parallel tool responses', () => {
    expect(adaptClaudeResponse(claudeMockResponses.textResponse('Claude final answer'))).toEqual({
      type: 'text',
      text: 'Claude final answer',
    });
    expect(adaptClaudeResponse(claudeMockResponses.singleToolCall('cancelOrder', { orderId: 'order-001' }))).toEqual({
      type: 'tool_call',
      toolName: 'cancelOrder',
      toolArgs: { orderId: 'order-001' },
      callId: 'tool_abc123',
    });
    expect(
      adaptClaudeResponse(
        claudeMockResponses.parallelToolCalls([
          { name: 'checkInventory', args: { productId: 'product-001' } },
          { name: 'getOrderStatus', args: { orderId: 'order-002' } },
        ])
      )
    ).toEqual({
      type: 'tool_calls',
      toolCalls: [
        { toolName: 'checkInventory', toolArgs: { productId: 'product-001' }, callId: 'tool_0' },
        { toolName: 'getOrderStatus', toolArgs: { orderId: 'order-002' }, callId: 'tool_1' },
      ],
    });
  });

  it('should adapt Groq responses with the OpenAI adapter format', () => {
    const response = groqMockResponses.singleToolCall('getOrderStatus', { orderId: 'order-002' });

    expect(adaptGroqResponse(response)).toEqual({
      type: 'tool_call',
      toolName: 'getOrderStatus',
      toolArgs: { orderId: 'order-002' },
      callId: 'call_abc123',
    });
  });

  it('should expose provider tool definitions in each provider format', () => {
    expect(geminiToolDef.functionDeclarations).toHaveLength(2);
    expect(geminiToolDef.functionDeclarations[0]).toMatchObject({
      name: 'checkInventory',
      parameters: {
        type: 'OBJECT',
        required: ['productId'],
      },
    });

    expect(openaiToolDef[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'checkInventory',
        parameters: {
          type: 'object',
          required: ['productId'],
        },
      },
    });

    expect(claudeToolDef[1]).toMatchObject({
      name: 'getOrderStatus',
      input_schema: {
        type: 'object',
        required: ['orderId'],
      },
    });
  });

  it('should return safe empty text responses for missing provider payloads', () => {
    expect(adaptOpenAIResponse({})).toEqual({ type: 'text', text: 'No response' });
    expect(adaptClaudeResponse({})).toEqual({ type: 'text', text: '' });
  });
});
