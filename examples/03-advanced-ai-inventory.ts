/**
 * ADVANCED AI-POWERED INVENTORY SYSTEM
 * 
 * This demonstrates the REAL power of AILink SDK:
 * ✅ Multi-turn conversations with context memory
 * ✅ AI reasoning and decision-making
 * ✅ Complex scenarios showing true AI intelligence
 * ✅ Compare: What a developer would need to code vs. what AI handles
 * 
 * RUN: npx ts-node example/03-advanced-ai-inventory.ts
 */

import { AILink, AILinkSession } from '../src'
import { SimpleInventorySystem } from './01-simple-inventory'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Note: This example uses multiple API calls in sequence.
// If using Groq free tier, you may hit rate limits.
// Increase the pause() delay or use a paid API key for best results.

dotenv.config({ path: path.join(__dirname, '../.env') })

class AdvancedAIInventorySystem {
  private system: SimpleInventorySystem
  private ai: AILink
  private session: AILinkSession

  constructor(providerKey: string) {
    this.system = new SimpleInventorySystem()
    
    this.ai = new AILink({
      apiKey: 'inventory-ai-key',
      provider: 'groq',
      providerKey: providerKey,
      debug: true,
    })

    this.setupAITools()
    
    // Create a session so AI remembers context across conversations
    this.session = this.ai.createSession('inventory-demo-session')
  }

  private setupAITools() {
    // ─── Tool 1: Check Product with Price Comparison ───────────
    this.ai.register(
      'checkProductAvailability',
      async ({ productName }: { productName: string }) => {
        const products = this.system.listProducts()
        const product = products.find(p => 
          p.name.toLowerCase().includes(productName.toLowerCase())
        )

        if (!product) {
          // Smart response - suggest alternatives
          const alternatives = products.map(p => `${p.name} ($${p.price})`).join(', ')
          return `Product not found. Available alternatives: ${alternatives}`
        }

        const stock = this.system.checkStock(product.id)
        const status = stock === 0 ? '❌ OUT OF STOCK' : 
                      stock < 5 ? '⚠️ LOW STOCK' : '✅ IN STOCK'
        
        return `${status} | ${product.name}\n` +
               `  • Price: $${product.price}\n` +
               `  • Available: ${stock} units\n` +
               `  • Can fulfill order: ${stock >= 10 ? 'Yes (bulk available)' : stock > 0 ? 'Yes (limited)' : 'No'}`
      },
      {
        description: 'Check if a product is available. After calling this tool, reply in one natural sentence with the product name, stock status, and price. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {
            productName: {
              type: 'string',
              description: 'Name of the product (e.g., "laptop", "mouse")'
            }
          },
          required: ['productName']
        }
      }
    )

    // ─── Tool 2: Smart Order Placement with Negotiation ────────
    this.ai.register(
      'smartPlaceOrder',
      async ({ productName, quantity, allowPartialFulfillment }: { 
        productName: string
        quantity: number
        allowPartialFulfillment?: boolean 
      }) => {
        const products = this.system.listProducts()
        const product = products.find(p =>
          p.name.toLowerCase().includes(productName.toLowerCase())
        )

        if (!product) {
          return `✗ Cannot order: "${productName}" not found. Check available products first.`
        }

        const stock = this.system.checkStock(product.id)

        // Smart negotiation logic
        if (stock === 0) {
          return `✗ Order failed: ${product.name} is out of stock.\n` +
                 `   💡 Suggestion: Would you like to wait or order a different product?`
        }

        if (stock < quantity && !allowPartialFulfillment) {
          return `⚠️ Insufficient stock for full order:\n` +
                 `   • Requested: ${quantity} units\n` +
                 `   • Available: ${stock} units\n` +
                 `   • Total cost (full): $${quantity * product.price}\n` +
                 `   • Total cost (partial): $${stock * product.price}\n` +
                 `   💡 Would you like to order ${stock} units instead?`
        }

        try {
          const orderQuantity = Math.min(quantity, stock)
          const orderId = this.system.placeOrder(product.id, orderQuantity)
          const total = product.price * orderQuantity
          const note = orderQuantity < quantity ? `(Partial: ${quantity - orderQuantity} units not available)` : ''
          
          return `✅ Order SUCCESS! ${note}\n` +
                 `   • Order ID: ${orderId}\n` +
                 `   • Item: ${orderQuantity}x ${product.name}\n` +
                 `   • Unit Price: $${product.price}\n` +
                 `   • Total: $${total}\n` +
                 `   • Remaining Stock: ${stock - orderQuantity} units\n` +
                 `   • Order Status: Processing`
        } catch (err: any) {
          return `✗ Error: ${err.message}`
        }
      },
      {
        description: 'Place a smart order for a single product. After calling this tool, reply in one or two natural sentences confirming the order or explaining why it could not be fulfilled. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {
            productName: {
              type: 'string',
              description: 'Name of the product to order'
            },
            quantity: {
              type: 'number',
              description: 'Number of units requested'
            },
            allowPartialFulfillment: {
              type: 'boolean',
              description: 'Allow order to be partially fulfilled if insufficient stock'
            }
          },
          required: ['productName', 'quantity']
        }
      }
    )

    // ─── Tool 3: Inventory Analysis & Recommendations ─────────
    this.ai.register(
      'analyzeInventory',
      async () => {
        const products = this.system.listProducts()
        const report = this.system.generateReport()
        
        // AI-generated insights
        const outOfStock = products.filter(p => this.system.checkStock(p.id) === 0)
        const lowStock = products.filter(p => {
          const stock = this.system.checkStock(p.id)
          return stock > 0 && stock < 5
        })
        const wellStocked = products.filter(p => this.system.checkStock(p.id) >= 10)

        let analysis = `📊 INVENTORY ANALYSIS REPORT\n` +
                       `═══════════════════════════════════\n\n` +
                       `${report}\n\n` +
                       `📈 INSIGHTS:\n`

        if (outOfStock.length > 0) {
          analysis += `   🔴 OUT OF STOCK (${outOfStock.length}): ${outOfStock.map(p => p.name).join(', ')}\n`
        }
        
        if (lowStock.length > 0) {
          analysis += `   🟡 LOW STOCK (${lowStock.length}): ${lowStock.map(p => 
            `${p.name} (${this.system.checkStock(p.id)} left)`).join(', ')}\n`
        }
        
        if (wellStocked.length > 0) {
          analysis += `   🟢 WELL STOCKED (${wellStocked.length}): ${wellStocked.map(p => p.name).join(', ')}\n`
        }

        analysis += `\n💡 RECOMMENDATIONS:\n`
        if (outOfStock.length > 0) {
          analysis += `   • Reorder ${outOfStock.map(p => p.name).join(', ')} immediately\n`
        }
        if (lowStock.length > 0) {
          analysis += `   • Schedule restock for: ${lowStock.map(p => p.name).join(', ')}\n`
        }
        analysis += `   • Promote well-stocked items to increase sales\n`

        return analysis
      },
      {
        description: 'Analyze the full inventory and flag what is out of stock or running low. After calling this tool, summarize the critical items and top recommendation in three sentences or fewer. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    )

    // ─── Tool 4: Multi-Order Planning (AI Planning) ───────────
    this.ai.register(
      'planBulkOrder',
      async ({ items }: { items: Array<{ product: string; quantity: number }> }) => {
        let plan = `📋 BULK ORDER PLAN\n═════════════════════\n\n`
        let totalCost = 0
        let feasible = true

        for (const item of items) {
          const products = this.system.listProducts()
          const product = products.find(p => 
            p.name.toLowerCase().includes(item.product.toLowerCase())
          )

          if (!product) {
            plan += `❌ ${item.product}: NOT FOUND\n`
            feasible = false
            continue
          }

          const stock = this.system.checkStock(product.id)
          const cost = product.price * item.quantity
          const canFulfill = stock >= item.quantity

          plan += `${canFulfill ? '✅' : '⚠️'} ${product.name}\n`
          plan += `   • Quantity: ${item.quantity} units\n`
          plan += `   • Unit Price: $${product.price}\n`
          plan += `   • Subtotal: $${cost}\n`
          plan += `   • Stock Available: ${stock}/${item.quantity}\n`
          
          if (!canFulfill) {
            plan += `   • Status: PARTIAL (Can fulfill ${stock}/${item.quantity})\n`
            feasible = false
          }
          
          plan += `\n`
          totalCost += cost
        }

        plan += `\n📊 ORDER SUMMARY\n───────────────────\n`
        plan += `• Total Items: ${items.length} product types\n`
        plan += `• Total Units: ${items.reduce((sum, i) => sum + i.quantity, 0)}\n`
        plan += `• Total Cost: $${totalCost}\n`
        plan += `• Status: ${feasible ? '✅ READY TO PROCESS' : '⚠️ REQUIRES APPROVAL (PARTIAL FULFILLMENT)'}\n`

        return plan
      },
      {
        description: 'Check stock feasibility for multiple items without placing any orders. After calling this tool, summarize what can and cannot be fulfilled and give a total cost in three sentences or fewer. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'Array of items with product name and quantity',
              items: {
                type: 'object',
                properties: {
                  product: { type: 'string', description: 'Product name' },
                  quantity: { type: 'number', description: 'Number of units' }
                },
                required: ['product', 'quantity']
              }
            }
          },
          required: ['items']
        }
      }
    )

    // ─── Tool 5: Get Order History with Context ────────────────
    this.ai.register(
      'getOrderHistory',
      async () => {
        const orders = this.system.getOrderHistory()

        if (orders.length === 0) {
          return 'No orders placed yet. Ready to take your first order!'
        }

        let history = `📜 ORDER HISTORY (${orders.length} total)\n════════════════════════════════════\n\n`
        
        let totalSpent = 0
        for (const order of orders) {
          history += `Order ${order.id}\n`
          history += `  • Quantity: ${order.quantity} units\n`
          history += `  • Status: ${order.status}\n`
          totalSpent += (order.quantity * 50) // Rough estimate
        }

        history += `\n💰 SUMMARY:\n`
        history += `  • Total Orders: ${orders.length}\n`
        history += `  • Total Units Ordered: ${orders.reduce((sum, o) => sum + o.quantity, 0)}\n`
        history += `  • Estimated Total Value: $${totalSpent}\n`

        return history
      },
      {
        description: 'Retrieve the order history. After calling this tool, summarize the total number of orders and total units ordered in one or two sentences. Do not call any other tools.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    )
  }

  // Multi-turn conversation with session memory
  async chat(userMessage: string): Promise<string> {
    console.log(`\n👤 You: ${userMessage}`)
    
    const result = await this.session.run(userMessage)
    
    console.log(`🤖 AI: ${result.response}`)
    
    if (result.toolsCalled && result.toolsCalled.length > 0) {
      console.log(`   [🔧 Tools Used: ${result.toolsCalled.join(', ')}]`)
    }
    
    return result.response
  }

  addProduct(name: string, price: number, stock: number): void {
    this.system.addProduct(name, price, stock)
  }

  getSession(): AILinkSession {
    return this.session
  }
}

// ═════════════════════════════════════════════════════════
// DEMO: Advanced AI Inventory System
// ═════════════════════════════════════════════════════════

async function runAdvancedDemo() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     ADVANCED AI-POWERED INVENTORY (Real AI Reasoning)     ║
║  Demonstrates: Sessions, Context, Planning, Intelligence  ║
╚════════════════════════════════════════════════════════════╝
`)

  const providerKey = process.env.GROQ_KEY
  if (!providerKey) {
    console.error('❌ GROQ_KEY not set in .env')
    process.exit(1)
  }

  const system = new AdvancedAIInventorySystem(providerKey)

  // Setup products
  // NOTE: 1ms gaps ensure unique Date.now() IDs — without them all five
  // synchronous calls produce the same Map key and overwrite each other.
  console.log('📦 Setting up inventory...')
  system.addProduct('Professional Laptop', 1200, 3)
  await new Promise(r => setTimeout(r, 1))
  system.addProduct('Wireless Mouse', 45, 15)
  await new Promise(r => setTimeout(r, 1))
  system.addProduct('USB-C Cable', 15, 50)
  await new Promise(r => setTimeout(r, 1))
  system.addProduct('Monitor 4K', 450, 2)
  await new Promise(r => setTimeout(r, 1))
  system.addProduct('Mechanical Keyboard', 120, 0) // Out of stock
  console.log('✓ 5 products loaded\n')

  // Small delay between calls to respect Groq free-tier rate limits
  const pause = () => new Promise(r => setTimeout(r, 5000))

  // Multi-turn conversation showing context memory
  console.log('═══════════════════════════════════════════════════════════')
  console.log('SCENARIO 1: Simple Query')
  console.log('═══════════════════════════════════════════════════════════')
  await system.chat('List all products with their names, prices, and current stock levels.')
  await pause()

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('SCENARIO 2: Intelligent Analysis (AI Reasoning)')
  console.log('═══════════════════════════════════════════════════════════')
  await system.chat('Analyze the inventory and tell me which items are out of stock or critically low.')
  await pause()

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('SCENARIO 3: Smart Order with Negotiation')
  console.log('═══════════════════════════════════════════════════════════')
  await system.chat('I need 5 Mechanical Keyboards for a corporate event. Place the order.')
  await pause()

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('SCENARIO 4: Complex Request (Multi-step Planning)')
  console.log('═══════════════════════════════════════════════════════════')
  await system.chat('Check if we can fulfill 3 laptops, 3 monitors, 6 mice, 6 cables, and 3 keyboards. Give me the total cost and flag anything we cannot fulfill.')
  await pause()

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('SCENARIO 5: Context Memory (AI Remembers Previous Turns)')
  console.log('═══════════════════════════════════════════════════════════')
  await system.chat('Based on the analysis earlier, which item should we reorder first?')
  await pause()

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('SCENARIO 6: Order History (Context-Aware)')
  console.log('═══════════════════════════════════════════════════════════')
  await system.chat('How many orders have been placed and how many total units were ordered?')

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('✅ DEMO COMPLETE')
  console.log('═══════════════════════════════════════════════════════════')

  console.log(`
📊 WHAT YOU JUST SAW (The Real Power of AILink SDK):

✅ MULTI-TURN CONTEXT:
   → AI remembered earlier analysis when asked about reorders
   → Session maintained conversation history automatically

✅ INTELLIGENT REASONING:
   → AI analyzed inventory and made recommendations
   → Smart negotiation on out-of-stock items
   → Complex order planning across multiple items

✅ NATURAL LANGUAGE UNDERSTANDING:
   → No code changes needed for new queries
   → AI understood "3 workstations" = multiple orders
   → Parsed requirements and created plan

✅ CONTEXT-AWARE RESPONSES:
   → AI referred back to previous conversation
   → Generated totals and summaries automatically
   → Made decisions based on accumulated context

─────────────────────────────────────────────────────────────

🚀 WITHOUT AILink SDK, YOU'D NEED TO CODE:

❌ Manual context tracking across API calls
❌ Parsing natural language into commands  
❌ Implementing negotiation logic
❌ Planning algorithm for multi-item orders
❌ Session memory management
❌ Conversation history handling
❌ Error recovery and alternatives
❌ And 50+ more features...

✅ WITH AILink SDK:
   Just register your functions!
   AI handles everything else.

─────────────────────────────────────────────────────────────
`)
}

// Run if this is the main module
if (require.main === module) {
  runAdvancedDemo().catch(console.error)
}

export { AdvancedAIInventorySystem }
