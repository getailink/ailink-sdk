/**
 * AI-Powered Inventory Management System
 * Using AILink SDK for natural language control
 * 
 * Now users can manage inventory by just talking to the AI!
 * Example: "I need 5 laptops" → AI understands and processes the order
 */

import { AILink } from '../src'
import { SimpleInventorySystem } from './01-simple-inventory'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment
dotenv.config({ path: path.join(__dirname, '../.env') })

class AIInventorySystem {
  private system: SimpleInventorySystem
  private ai: AILink

  constructor(providerKey: string) {
    this.system = new SimpleInventorySystem()
    
    // Initialize AILink with Groq provider
    this.ai = new AILink({
      apiKey: 'inventory-ai-key',
      provider: 'groq',
      providerKey: providerKey,
      debug: false,
    })

    this.setupAITools()
  }

  private setupAITools() {
    // ─── Tool 1: Check Product Availability ───────────────────
    this.ai.register(
      'checkProductAvailability',
      async ({ productName }: { productName: string }) => {
        // Find product by name
        const products = this.system.listProducts()
        const product = products.find(p => 
          p.name.toLowerCase().includes(productName.toLowerCase())
        )

        if (!product) {
          return `Product "${productName}" not found in inventory`
        }

        return `✓ ${product.name} is available. Stock: ${this.system.checkStock(product.id)} units at $${product.price} each`
      },
      {
        description: 'Check if a product is in stock. After calling this tool, reply in one natural sentence stating the product name, stock count, and price. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {
            productName: {
              type: 'string',
              description: 'Name of the product to check (e.g., "laptop", "mouse")'
            }
          },
          required: ['productName']
        }
      }
    )

    // ─── Tool 2: Place Order ───────────────────────────────────
    this.ai.register(
      'placeOrder',
      async ({ productName, quantity }: { productName: string; quantity: number }) => {
        const products = this.system.listProducts()
        const product = products.find(p =>
          p.name.toLowerCase().includes(productName.toLowerCase())
        )

        if (!product) {
          return `Cannot place order: Product "${productName}" not found`
        }

        try {
          const orderId = this.system.placeOrder(product.id, quantity)
          const total = product.price * quantity
          return `✓ Order placed successfully!\n  Order ID: ${orderId}\n  Item: ${quantity}x ${product.name}\n  Total: $${total}`
        } catch (err: any) {
          return `✗ Order failed: ${err.message}`
        }
      },
      {
        description: 'Place an order for a single product. After calling this tool, confirm the order in one sentence with the item name, quantity, and total cost. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {
            productName: {
              type: 'string',
              description: 'Name of the product to order'
            },
            quantity: {
              type: 'number',
              description: 'Number of units to order'
            }
          },
          required: ['productName', 'quantity']
        }
      }
    )

    // ─── Tool 3: Get Inventory Report ─────────────────────────
    this.ai.register(
      'getInventoryReport',
      async () => {
        return this.system.generateReport()
      },
      {
        description: 'Get the current inventory. After calling this tool, present the products as a clean bullet list with name, price, and stock count. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    )

    // ─── Tool 4: List All Products ────────────────────────────
    this.ai.register(
      'listAllProducts',
      async () => {
        const products = this.system.listProducts()
        if (products.length === 0) {
          return 'No products in inventory'
        }

        let list = 'Available Products:\n'
        for (const product of products) {
          list += `  • ${product.name} - $${product.price} (${this.system.checkStock(product.id)} in stock)\n`
        }
        return list
      },
      {
        description: 'List all products with their prices and stock counts. After calling this tool, present results as a clean bullet list. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    )

    // ─── Tool 5: Get Order History ────────────────────────────
    this.ai.register(
      'getOrderHistory',
      async ({ limit }: { limit?: number } = {}) => {
        const orders = this.system.getOrderHistory()
        const recent = limit ? orders.slice(-limit) : orders

        if (recent.length === 0) {
          return 'No orders placed yet'
        }

        let history = `Recent Orders (${recent.length}):\n`
        for (const order of recent) {
          history += `  • Order ${order.id}: ${order.quantity} units (${order.status})\n`
        }
        return history
      },
      {
        description: 'Get recent orders. After calling this tool, describe the most recent order in one natural sentence. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of recent orders to retrieve'
            }
          }
        }
      }
    )
  }

  // Public method to add products (for setup)
  addProduct(name: string, price: number, stock: number): void {
    this.system.addProduct(name, price, stock)
  }

  // Main method: Chat with AI about inventory
  async chat(userMessage: string): Promise<string> {
    console.log(`\n👤 You: ${userMessage}`)
    
    const result = await this.ai.run(userMessage)
    
    console.log(`🤖 AI: ${result.response}`)
    
    if (result.toolsCalled && result.toolsCalled.length > 0) {
      console.log(`   [Used tools: ${result.toolsCalled.join(', ')}]`)
    }
    
    return result.response
  }
}

// ─── DEMO: AI Inventory System ─────────────────────────────

async function aiDemo() {
  console.log('╔════════════════════════════════════════════════════╗')
  console.log('║ AI-Powered Inventory System (Using AILink SDK)     ║')
  console.log('╚════════════════════════════════════════════════════╝\n')

  const groqKey = process.env.GROQ_KEY
  if (!groqKey) {
    console.error('❌ GROQ_KEY not found in .env')
    console.error('Add your key to .env: GROQ_KEY=your-key-here')
    process.exit(1)
  }

  const inventory = new AIInventorySystem(groqKey)

  // Setup products
  // NOTE: Each addProduct call needs a 1ms gap because the underlying
  // SimpleInventorySystem uses Date.now() as the product ID. Synchronous
  // calls within the same millisecond produce the same ID and overwrite
  // each other in the Map, leaving only the last product visible.
  console.log('📦 Setting up inventory...')
  inventory.addProduct('Dell Laptop', 899, 5)
  await new Promise(r => setTimeout(r, 1))
  inventory.addProduct('Wireless Mouse', 29, 50)
  await new Promise(r => setTimeout(r, 1))
  inventory.addProduct('Mechanical Keyboard', 149, 12)
  await new Promise(r => setTimeout(r, 1))
  inventory.addProduct('USB-C Cable', 15, 100)
  console.log('✓ 4 products added\n')

  // Have natural language conversations with AI
  console.log('═══════════════════════════════════════════════════════\n')

  // Small delay between calls to respect Groq free-tier rate limits
  const pause = () => new Promise(r => setTimeout(r, 2000))

  await inventory.chat('List all products with their prices and stock levels.')
  await pause()

  await inventory.chat('How many Dell Laptops are in stock?')
  await pause()

  await inventory.chat('Place an order for 2 Dell Laptops.')
  await pause()

  await inventory.chat('Place an order for 5 Wireless Mice.')
  await pause()

  await inventory.chat('What was the most recent order placed?')
  await pause()

  await inventory.chat('Try to order 100 Mechanical Keyboards and tell me exactly what happens.')

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('✅ Demo complete! The inventory system is now AI-powered!\n')
}

// Run demo
aiDemo().catch(console.error)
