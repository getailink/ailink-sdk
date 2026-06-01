# AI Transformation Example: Inventory System

## Overview

This example shows how to take a **simple, real-world project** and transform it into an **AI-powered application** using the AILink SDK.

---

## The Story

Imagine you have a simple inventory management system. It works fine, but it requires developers to:
- Write code for each operation
- Build a UI/API
- Handle complex user input

Now imagine your users could just **talk to an AI** and manage inventory naturally!

```
Before:  User → API/UI → Code → Database
After:   User → Natural Language → AI → Tools → Database
```

---

## Project 1: Simple Inventory (No AI)

### File: `01-simple-inventory.ts`

**What it does:**
- Manages products (add, check stock, list)
- Manages orders (place, cancel, history)
- Generates reports

**How to use it (Programmatically):**
```typescript
const system = new SimpleInventorySystem()

// Add products
system.addProduct('Laptop', 899, 5)
system.addProduct('Mouse', 29, 50)

// Check stock
const laptopStock = system.checkStock(product1)  // Returns: 5

// Place order
const orderId = system.placeOrder(product1, 2)   // Returns: order-1

// Get report
const report = system.generateReport()
```

**Problems:**
- Only developers can use it
- No natural language interface
- Requires writing code for each action
- No flexibility

**Run it:**
```bash
npx ts-node example/01-simple-inventory.ts
```

---

## Project 2: AI-Powered Inventory (With AILink)

### File: `02-ai-inventory.ts`

**What it does:**
- Takes the same inventory system
- Adds AILink SDK for natural language understanding
- Registers functions as AI tools
- Lets users manage inventory by talking!

**How to use it (Natural Language):**
```
User: "What products do we have?"
AI: "We have 4 products: Laptop, Mouse, Keyboard, Cable"

User: "I need 2 laptops"
AI: "Order placed! 2 Laptops = $1798"

User: "Show me the inventory report"
AI: [Returns full report]
```

**Key Difference:**
```
Simple System:
  system.placeOrder(productId, 2)
  
AI System:
  "I want to order 2 laptops"
  → AI understands
  → AI calls placeOrder() automatically
  → Returns human-friendly response
```

**Run it:**
```bash
npx ts-node example/02-ai-inventory.ts
```

---

## Side-by-Side Comparison

### Adding a Function

#### Simple System
```typescript
// Just a method
placeOrder(productId: string, quantity: number): string {
  // ... logic
  return orderId
}

// Users call it directly
const order = system.placeOrder('prod-123', 2)
```

#### AI System
```typescript
// Register as AI tool
ai.register(
  'placeOrder',
  async ({ productName, quantity }: { productName: string; quantity: number }) => {
    // ... same logic, but AI-friendly
    return `✓ Order placed: ${quantity}x ${productName}`
  },
  {
    description: 'Place an order for a product',
    parameters: {
      type: 'object',
      properties: {
        productName: { type: 'string' },
        quantity: { type: 'number' }
      },
      required: ['productName', 'quantity']
    }
  }
)

// Users talk to AI
await ai.run('I need 2 laptops')
// → AI automatically calls placeOrder()
```

---

## The Benefits

### ❌ Without AI
```
Developer needed for:
  • Building API endpoints
  • Creating UI forms
  • Parsing user input
  • Validation logic
  • Error handling

Result: Complex, inflexible, dev-dependent
```

### ✅ With AILink
```
No extra development:
  • Just register your functions
  • AI understands natural language
  • AI validates inputs (JSON schema)
  • AI handles errors gracefully
  • Works with voice, chat, text

Result: Simple, flexible, user-friendly
```

---

## How AILink Makes This Work

### 1. Register Functions

```typescript
ai.register('functionName', async (args) => {
  // Your business logic
  return result
}, {
  description: 'What this does',
  parameters: { ... }
})
```

### 2. Users Chat

```
User: "I need 5 keyboards"
```

### 3. AI Understands

```typescript
// AI reads the description and parameters
// Matches user request to the right function
// Calls: placeOrder({ productName: 'keyboards', quantity: 5 })
```

### 4. Function Executes

```typescript
// Your function runs exactly as written
// Business logic unchanged
const orderId = system.placeOrder(keyboardId, 5)
```

### 5. AI Responds

```
"✓ Order placed! 5 Keyboards = $745"
```

---

## Code Structure

```
example/
├── 01-simple-inventory.ts     ← Original simple system
├── 02-ai-inventory.ts         ← AI-powered version
└── BEFORE_AND_AFTER.md        ← This file

Key insight:
- Simple system has ~100 lines
- AI system uses same 100 lines + 200 lines for AI tools
- No changes to business logic
```

---

## Real-World Scenario

### Scenario: Busy Store Manager

**Without AI (Old Way):**
```
Manager: "I need to check stock, place 3 orders, and see the report"
Developer: "I'll build you a dashboard"
[Developer spends 2 weeks building]
Manager: "Can I also check by category?"
Developer: "I'll add that feature"
[Developer spends 1 more week]
```

**With AI (New Way):**
```
Manager: "AI, check stock on laptops"
AI: "You have 5 laptops"
Manager: "Order 3 laptops, 10 mice, and 5 keyboards"
AI: "Done! 3 orders placed"
Manager: "Show me the inventory"
AI: [Shows report]
Manager: "Orders from today?"
AI: [Shows today's orders]
```

No developer time needed! Just register the functions once.

---

## How to Try It

### Step 1: Run Simple Version
```bash
cd ailink-ts-v3/ailink-ts
npx ts-node example/01-simple-inventory.ts
```

Output:
```
📦 Adding products...
✓ Added 3 products

📊 Current stock:
  - Laptop: 5 units
  - Mouse: 50 units
  - Keyboard: 12 units

📋 Placing orders...
✓ Order order-1: 2 laptops
✓ Order order-2: 10 mice
```

### Step 2: Run AI Version
```bash
npx ts-node example/02-ai-inventory.ts
```

Output:
```
👤 You: What products do we have?
🤖 AI: We have 4 products: Dell Laptop, Wireless Mouse...
   [Used tools: listAllProducts]

👤 You: I need 2 laptops
🤖 AI: Order placed! 2 Laptops = $1798
   [Used tools: placeOrder]
```

---

## Key Files to Understand

| File | Lines | Purpose |
|------|-------|---------|
| `01-simple-inventory.ts` | ~150 | Pure business logic (no AI) |
| `02-ai-inventory.ts` | ~250 | Same logic + AI integration |
| Difference | +100 | Just AILink setup and tool registration |

---

## The AILink SDK at Work

This example demonstrates all key AILink features:

✅ **Function Registration**
- Registering 5 tools (check stock, place order, get report, etc.)

✅ **Tool Calling**
- AI automatically calls the right tool based on user input

✅ **JSON Schema Validation**
- Each tool has parameter validation

✅ **Multi-turn Memory** (Easy to add)
- Could add sessions for ongoing conversations

✅ **Real API Integration**
- Uses real GROQ API for language understanding

✅ **Provider Flexibility**
- Could swap 'groq' for 'openai', 'claude', 'gemini'

---

## What's Happening Under the Hood

```
User: "I need 5 laptops"
  ↓
AILink receives request
  ↓
AI reads tool descriptions:
  - checkProductAvailability() → "Check if a product is in stock"
  - placeOrder() → "Place an order for a product"
  - getInventoryReport() → "Get a full inventory report"
  ↓
AI decides: "This is about placing an order"
  ↓
AI calls: placeOrder({ productName: 'laptops', quantity: 5 })
  ↓
Your function runs:
  - Finds 'laptop' product
  - Deducts 5 from stock
  - Creates order record
  - Returns: "✓ Order placed..."
  ↓
AI formats response and returns to user
```

No extra code needed. AILink handles all the "AI magic" - you just register your functions!

---

## Extending It Further

### Easy Additions:

1. **Add More Tools**
```typescript
ai.register('getLowStockItems', async () => {
  // Your logic
}, { description: '...', parameters: {} })
```

2. **Add Session Memory**
```typescript
const session = ai.createSession()
await session.run('Add 10 mice')
await session.run('And 5 keyboards too')
// AI remembers context!
```

3. **Add Role-Based Access**
```typescript
ai.register('deleteProduct', async (args) => {
  // ...
}, {
  description: '...',
  roles: ['admin']  // Only admins can delete!
})

await ai.run('Delete the keyboard', { userRole: 'admin' })
```

4. **Swap Providers**
```typescript
// Currently: Groq
// Change to: OpenAI, Claude, or Gemini
// Just change one line!
provider: 'openai'
```

---

## Summary

| Aspect | Simple | AI-Powered |
|--------|--------|-----------|
| **User Interface** | Code only | Natural language |
| **Learning curve** | Steep | Shallow |
| **Flexibility** | Low | High |
| **Development time** | Fast → Slow as features grow | Fast + stays fast |
| **Who can use it** | Developers | Anyone |
| **Setup** | Just write functions | Register functions + AI |

---

## Next Steps

1. ✅ Run both examples to see the difference
2. ✅ Read the code in `02-ai-inventory.ts`
3. ✅ Try modifying the chat prompts
4. ✅ Add your own tools
5. ✅ Use it as a template for your own AI project!

---

## Files You Need

- `example/01-simple-inventory.ts` - Run this first
- `example/02-ai-inventory.ts` - Then this
- `.env.real-test` - Must have GROQ_KEY set

---

This is AILink in action: **Turn any project into an AI project in minutes!** 🚀
