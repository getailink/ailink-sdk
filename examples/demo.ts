// ─────────────────────────────────────────────
// AILink — Working Demo
// Run: GEMINI_KEY=your_key npm run dev
// ─────────────────────────────────────────────

import { AILink } from '../src';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// ── Mock database ─────────────────────────────
const inventory: Record<string, number> = {
  'product-001': 45,
  'product-002': 0,
  'product-003': 12,
};

const orders: Record<string, { status: string; product: string; qty: number }> = {
  'order-001': { status: 'pending', product: 'product-001', qty: 3 },
  'order-002': { status: 'shipped', product: 'product-003', qty: 1 },
};

// ── Initialize AILink ─────────────────────────
const ai = new AILink({
  apiKey: process.env.AILINK_KEY || 'demo-key',
  provider: 'groq',
  providerKey: process.env.GROQ_KEY || '',
  debug: true,
});

// ── Register your app functions ───────────────
ai.register(
  'checkInventory',
  'Check the stock level for a product. After calling this tool, reply in one natural sentence stating whether the product is in stock and how many units remain. Do not call any other tools.',
  {
    type: 'object',
    properties: {
      productId: { type: 'string', description: 'The product ID to check' },
    },
    required: ['productId'],
  },
  async ({ productId }) => {
    const stock = inventory[productId];
    if (stock === undefined) return { error: `Product ${productId} not found` };
    return { productId, stock, inStock: stock > 0 };
  }
);

ai.register(
  'getOrderStatus',
  'Look up the status of a specific order. After calling this tool, reply in one natural sentence with the order ID and its current status. Do not call any other tools.',
  {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'The order ID to look up' },
    },
    required: ['orderId'],
  },
  async ({ orderId }) => {
    const order = orders[orderId];
    if (!order) return { error: `Order ${orderId} not found` };
    return { orderId, ...order };
  }
);

ai.register(
  'cancelOrder',
  'Cancel a pending order. After calling this tool, confirm the cancellation in one sentence or explain why it failed. Do not call any other tools.',
  {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'The order ID to cancel' },
    },
    required: ['orderId'],
  },
  async ({ orderId }) => {
    const order = orders[orderId];
    if (!order) return { error: `Order ${orderId} not found` };
    if (order.status !== 'pending') return { error: `Cannot cancel order with status: ${order.status}` };
    orders[orderId].status = 'cancelled';
    return { success: true, message: `Order ${orderId} has been cancelled` };
  }
);

ai.register(
  'getLowStockProducts',
  'Find all products with stock below a given threshold. After calling this tool, list the low-stock products by name and count in two sentences or fewer. Do not call any other tools.',
  {
    type: 'object',
    properties: {
      threshold: { type: 'number', description: 'Stock level threshold. Default 10.' },
    },
  },
  async ({ threshold = 10 }) => {
    const low = Object.entries(inventory)
      .filter(([, stock]) => stock < threshold)
      .map(([productId, stock]) => ({ productId, stock }));
    return { lowStockProducts: low, count: low.length };
  }
);

// ── Run prompts ───────────────────────────────
async function main() {
  if (!process.env.GROQ_KEY) {
    console.error('Error: GROQ_KEY not found in .env');
    console.error('Add it to .env: GROQ_KEY=your-key-here');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(50));
  console.log('AILink Demo — Testing all registered tools');
  console.log('='.repeat(50) + '\n');

  const prompts = [
    'Check stock for product-001 and tell me how many units are available.',
    'What is the current status of order-002?',
    'Cancel order-001.',
    'Which products have fewer than 10 units in stock?',
  ];

  for (const prompt of prompts) {
    console.log(`\nQuestion: "${prompt}"`);
    const result = await ai.run(prompt);
    console.log(`Answer: ${result.response}`);
    console.log(`Tools used: ${result.toolsCalled.join(', ') || 'none'}`);
    console.log(`Time: ${result.executionTime}ms`);
    console.log('-'.repeat(40));
  }
}

main().catch(console.error);
