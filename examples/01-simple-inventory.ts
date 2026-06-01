/**
 * Simple Inventory Management System
 * No AI, just basic functions
 * 
 * This is a real-world example of a simple project that could benefit from AI.
 */

// Database (in-memory)
interface Product {
  id: string
  name: string
  price: number
  stock: number
}

interface Order {
  id: string
  productId: string
  quantity: number
  status: 'pending' | 'completed' | 'failed'
  createdAt: Date
}

class SimpleInventorySystem {
  private products: Map<string, Product> = new Map()
  private orders: Order[] = []
  private orderCounter = 1

  // ── Product Management ──────────────────────
  
  addProduct(name: string, price: number, initialStock: number): string {
    const id = `prod-${Date.now()}`
    this.products.set(id, { id, name, price, stock: initialStock })
    return id
  }

  checkStock(productId: string): number {
    return this.products.get(productId)?.stock ?? 0
  }

  getProductPrice(productId: string): number {
    return this.products.get(productId)?.price ?? 0
  }

  listProducts(): Product[] {
    return Array.from(this.products.values())
  }

  // ── Order Management ────────────────────────

  placeOrder(productId: string, quantity: number): string {
    const product = this.products.get(productId)
    
    if (!product) {
      throw new Error(`Product ${productId} not found`)
    }
    
    if (product.stock < quantity) {
      throw new Error(`Not enough stock. Available: ${product.stock}, Requested: ${quantity}`)
    }

    const orderId = `order-${this.orderCounter++}`
    
    // Deduct stock
    product.stock -= quantity

    // Create order
    const order: Order = {
      id: orderId,
      productId,
      quantity,
      status: 'completed',
      createdAt: new Date()
    }
    
    this.orders.push(order)
    return orderId
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.find(o => o.id === orderId)
    if (!order || order.status === 'completed') {
      return false
    }
    order.status = 'failed'
    return true
  }

  getOrderHistory(): Order[] {
    return this.orders
  }

  // ── Inventory Report ───────────────────────

  generateReport(): string {
    let report = 'INVENTORY REPORT\n'
    report += '================\n\n'
    
    for (const product of this.products.values()) {
      report += `${product.name} (${product.id})\n`
      report += `  Price: $${product.price}\n`
      report += `  Stock: ${product.stock} units\n\n`
    }
    
    report += `Total Orders: ${this.orders.length}\n`
    return report
  }
}

// ─── DEMO: Simple Usage ───────────────────────────────────

async function simpleDemo() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║ Simple Inventory System (No AI)        ║')
  console.log('╚════════════════════════════════════════╝\n')

  const system = new SimpleInventorySystem()

  // Add products
  console.log('📦 Adding products...')
  const laptop = system.addProduct('Dell Laptop', 899, 5)
  const mouse = system.addProduct('Wireless Mouse', 29, 50)
  const keyboard = system.addProduct('Mechanical Keyboard', 149, 12)
  console.log('✓ Added 3 products\n')

  // Check stock
  console.log('📊 Current stock:')
  console.log(`  - Laptop: ${system.checkStock(laptop)} units`)
  console.log(`  - Mouse: ${system.checkStock(mouse)} units`)
  console.log(`  - Keyboard: ${system.checkStock(keyboard)} units\n`)

  // Place orders
  console.log('📋 Placing orders...')
  try {
    const order1 = system.placeOrder(laptop, 2)
    console.log(`✓ Order ${order1}: 2 laptops`)
    
    const order2 = system.placeOrder(mouse, 10)
    console.log(`✓ Order ${order2}: 10 mice`)
  } catch (err: any) {
    console.log(`✗ Error: ${err.message}`)
  }
  console.log()

  // Try to order more than available
  console.log('📋 Trying to order 100 laptops (only 3 left)...')
  try {
    system.placeOrder(laptop, 100)
  } catch (err: any) {
    console.log(`✗ Failed: ${err.message}\n`)
  }

  // Show report
  console.log(system.generateReport())
}

// Export for use in AI example
export { SimpleInventorySystem, Product, Order }

// Run demo if this is the main file
if (require.main === module) {
  simpleDemo().catch(console.error)
}
