/**
 * Test Data Fixtures
 * Mock database, users, inventory, orders, etc.
 */

export const mockInventory: Record<string, number> = {
  'product-001': 45,
  'product-002': 0,
  'product-003': 12,
  'product-004': 100,
  'product-005': 3,
};

export const mockOrders: Record<string, any> = {
  'order-001': { status: 'pending', product: 'product-001', qty: 3, customerId: 'cust-001' },
  'order-002': { status: 'shipped', product: 'product-003', qty: 1, customerId: 'cust-002' },
  'order-003': { status: 'delivered', product: 'product-002', qty: 5, customerId: 'cust-001' },
  'order-004': { status: 'pending', product: 'product-004', qty: 2, customerId: 'cust-003' },
};

export const mockCustomers: Record<string, any> = {
  'cust-001': { name: 'John Doe', email: 'john@example.com' },
  'cust-002': { name: 'Jane Smith', email: 'jane@example.com' },
  'cust-003': { name: 'Bob Johnson', email: 'bob@example.com' },
};

export const mockPrompts = {
  simple: 'Do we have product-001 in stock?',
  multiTool: 'Check inventory for product-001 and product-002, and tell me the status of order-002',
  ordersOnly: 'What is the status of order-001?',
  parallel: 'Check stock for all products and tell me which ones are low',
  complex: 'Get orders for customer and cancel the first pending one',
  invalid: 'This prompt references non-existent tools',
};

export const mockResponses = {
  inStock: { productId: 'product-001', stock: 45, inStock: true },
  outOfStock: { productId: 'product-002', stock: 0, inStock: false },
  orderPending: { orderId: 'order-001', status: 'pending' },
  orderShipped: { orderId: 'order-002', status: 'shipped' },
  cancelSuccess: { success: true, message: 'Order cancelled' },
  cancelFailed: { success: false, error: 'Cannot cancel shipped order' },
};

export const mockUsers = {
  user: { role: 'user' as const, id: 'user-1' },
  admin: { role: 'admin' as const, id: 'admin-1' },
  developer: { role: 'developer' as const, id: 'dev-1' },
};

export const mockErrorMessages = {
  productNotFound: 'Product not found',
  orderNotFound: 'Order not found',
  invalidQuantity: 'Quantity must be greater than 0',
  customerNotFound: 'Customer not found',
  insufficientStock: 'Insufficient stock available',
};

// Tool execution handlers for testing
export const createMockToolHandlers = () => ({
  checkInventory: async ({ productId }: { productId: string }) => {
    const stock = mockInventory[productId];
    if (stock === undefined) return { error: `Product ${productId} not found` };
    return { productId, stock, inStock: stock > 0 };
  },

  getOrderStatus: async ({ orderId }: { orderId: string }) => {
    const order = mockOrders[orderId];
    if (!order) return { error: `Order ${orderId} not found` };
    return { orderId, ...order };
  },

  cancelOrder: async ({ orderId }: { orderId: string }) => {
    const order = mockOrders[orderId];
    if (!order) return { error: `Order ${orderId} not found` };
    if (order.status !== 'pending') return { error: `Cannot cancel ${order.status} order` };
    mockOrders[orderId].status = 'cancelled';
    return { success: true, message: `Order ${orderId} cancelled` };
  },

  updateInventory: async ({ productId, newStock }: { productId: string; newStock: number }) => {
    if (mockInventory[productId] === undefined) return { error: `Product ${productId} not found` };
    mockInventory[productId] = newStock;
    return { productId, stock: newStock, inStock: newStock > 0 };
  },

  getLowStockProducts: async ({ threshold = 10 }: { threshold?: number }) => {
    const low = Object.entries(mockInventory)
      .filter(([, stock]) => stock < threshold)
      .map(([productId, stock]) => ({ productId, stock }));
    return { lowStockProducts: low, count: low.length };
  },

  createOrder: async ({ productId, quantity, customerId }: any) => {
    if (!mockInventory[productId]) return { error: 'Product not found' };
    if (quantity <= 0) return { error: 'Invalid quantity' };
    if (!mockCustomers[customerId]) return { error: 'Customer not found' };
    if (mockInventory[productId] < quantity) return { error: 'Insufficient stock' };
    
    const orderId = `order-${Date.now()}`;
    mockOrders[orderId] = { status: 'pending', product: productId, qty: quantity, customerId };
    mockInventory[productId] -= quantity;
    return { success: true, orderId };
  },
});

// Reset function for tests that mutate state
export const resetMockData = () => {
  Object.assign(mockInventory, {
    'product-001': 45,
    'product-002': 0,
    'product-003': 12,
    'product-004': 100,
    'product-005': 3,
  });
  Object.keys(mockOrders).forEach(key => delete mockOrders[key]);
  Object.assign(mockOrders, {
    'order-001': { status: 'pending', product: 'product-001', qty: 3, customerId: 'cust-001' },
    'order-002': { status: 'shipped', product: 'product-003', qty: 1, customerId: 'cust-002' },
    'order-003': { status: 'delivered', product: 'product-002', qty: 5, customerId: 'cust-001' },
    'order-004': { status: 'pending', product: 'product-004', qty: 2, customerId: 'cust-003' },
  });
};
