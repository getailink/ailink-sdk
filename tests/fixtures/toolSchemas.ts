/**
 * Tool Schemas for Testing
 * Mock tool definitions used across tests
 */

export const toolSchemas = {
  checkInventory: {
    type: 'object',
    properties: {
      productId: { 
        type: 'string', 
        description: 'The product ID to check stock for' 
      },
    },
    required: ['productId'],
  },

  getOrderStatus: {
    type: 'object',
    properties: {
      orderId: { 
        type: 'string', 
        description: 'The order ID to look up' 
      },
    },
    required: ['orderId'],
  },

  cancelOrder: {
    type: 'object',
    properties: {
      orderId: { 
        type: 'string', 
        description: 'The order ID to cancel' 
      },
      reason: { 
        type: 'string', 
        description: 'Reason for cancellation (optional)' 
      },
    },
    required: ['orderId'],
  },

  getLowStockProducts: {
    type: 'object',
    properties: {
      threshold: { 
        type: 'number', 
        description: 'Stock level threshold' 
      },
    },
  },

  createOrder: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      quantity: { type: 'number', minimum: 1 },
      customerId: { type: 'string' },
    },
    required: ['productId', 'quantity', 'customerId'],
  },

  updateInventory: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      newStock: { type: 'number', minimum: 0 },
    },
    required: ['productId', 'newStock'],
  },

  complex: {
    type: 'object',
    properties: {
      filters: {
        type: 'object',
        properties: {
          status: { type: 'array', items: { type: 'string' } },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
          },
        },
      },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 },
        },
      },
    },
  },

  noParams: {
    type: 'object',
    properties: {},
  },
};

// Individual schema exports for convenience
export const inventorySchema = toolSchemas.checkInventory;
export const orderSchema = toolSchemas.getOrderStatus;
export const cancelSchema = toolSchemas.cancelOrder;
export const lowStockSchema = toolSchemas.getLowStockProducts;
