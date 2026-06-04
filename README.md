# AILink SDK

Your app already has the functions. AILink makes them AI-callable.
Use LangChain, Vercel AI SDK, or any other SDK without touching your existing code. AILink makes that possible.

No rewrites. No restructuring. Register once, your users talk to your app in natural language.

**Works with:** OpenAI · Claude · Groq · Gemini
**Use alongside:** LangChain · Vercel AI SDK · any existing SDK — zero rewrites

```bash
npm install @ailink/sdk
```

---

## Contents

- [Why AILink](#why-ailink)
- [How AILink Compares](#how-ailink-compares)
- [Install](#install)
- [Quick Start](#quick-start)
- [Core Features](#core-features)
  - [Function Registration](#function-registration)
  - [Wrapping External SDKs](#wrapping-external-sdks)
  - [Multi-Provider Support](#multi-provider-support)
  - [Fallback Providers](#fallback-providers)
  - [Role-Based Access Control](#role-based-access-control)
  - [Group Filtering](#group-filtering)
  - [Session Memory](#session-memory)
  - [Parallel Tool Execution](#parallel-tool-execution)
  - [Configurable Iteration Limit](#configurable-iteration-limit)
  - [Chat Widget](#chat-widget)
  - [Managing Tools](#managing-tools)
- [Configuration Reference](#configuration-reference)
- [Result Object](#result-object)
- [Error Handling](#error-handling)
- [Common Patterns](#common-patterns)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)

---

## Why AILink

Every other AI SDK makes you rewrite your code to fit their format. AILink works the other way — your existing functions stay exactly as they are. You register them once and the AI can call them.

```typescript
// Your existing function — untouched
async function getWeather(city: string) {
  return `22°C and sunny in ${city}`
}

// Register it once with AILink
ai.register('getWeather', async ({ city }) => getWeather(city), {
  description: 'Get current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' }
    },
    required: ['city']
  }
})

// Now anyone can use it with natural language
const result = await ai.run('What is the weather in Tokyo?')
console.log(result.response)
// → "It's currently 22°C and sunny in Tokyo."
```

---

## How AILink Compares

| Feature | AILink | Vercel AI SDK | LangChain |
|---|---|---|---|
| Works with existing code — no rewrites | ✅ | ❌ | ❌ |
| Use any external SDK without touching your code | ✅ | ❌ | ❌ |
| Role-based tool filtering — built in | ✅ | ❌ | ❌ |
| Group-based tool filtering | ✅ | ❌ | ❌ |
| Automatic fallback providers | ✅ | Via AI Gateway only | ✅ |
| Session memory — built in | ✅ | ✅ | ✅ Via LangGraph |
| Parallel tool execution | ✅ | ✅ | ✅ Via LangGraph |
| Usage tracking — built in | ✅ | ✅ Via OpenTelemetry | ✅ Via Callbacks/OTel |
| Multi-provider support | ✅ | ✅ | ✅ |
| Drop-in chat widget | ✅ | ❌ | ❌ |
| Streaming responses | ❌ | ✅ | ✅ |
| RAG / document retrieval | ❌ | ❌ | ✅ |
| Frontend React hooks | ❌ | ✅ | ❌ |

---

## Install

```bash
npm install @ailink/sdk
```

Requires Node.js 18 or higher.

---

## Quick Start

### 1. Get a provider API key

Pick one — all work the same way:

| Provider | Free Tier | Get Key |
|----------|-----------|---------|
| Groq | Yes, no card needed | [console.groq.com](https://console.groq.com) |
| Gemini | Yes, no card needed | [aistudio.google.com](https://aistudio.google.com) |
| OpenAI | Paid | [platform.openai.com](https://platform.openai.com) |
| Claude | Paid | [console.anthropic.com](https://console.anthropic.com) |

### 2. Initialize

```typescript
import { AILink } from '@ailink/sdk'

const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!
})
```

### 3. Register your functions

```typescript
ai.register('checkStock', async ({ productId }) => {
  // your existing function
  return inventory.check(productId)
}, {
  description: 'Check how many units of a product are in stock',
  parameters: {
    type: 'object',
    properties: {
      productId: { type: 'string', description: 'Product ID to check' }
    },
    required: ['productId']
  }
})
```

### 4. Run

```typescript
const result = await ai.run('How many units of product-001 do we have?')
console.log(result.response)
// → "You have 45 units of product-001 in stock."
```

---

## Core Features

### Function Registration

Register any async function as an AI-callable tool. The AI reads your description to decide when and how to call it.

```typescript
ai.register('functionName', async (args) => {
  return yourExistingFunction(args)
}, {
  description: 'Plain English — what does this function do?',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'What is this parameter?' }
    },
    required: ['param1']
  }
})
```

---

### Wrapping External SDKs

Every other SDK makes you rewrite your code to use it. AILink does not. `ai.wrap()` sits on top of any async function from any SDK — LangChain, Vercel AI SDK, Hugging Face, or anything else. Your existing code stays exactly as it is. Their code stays exactly as it is.

**Already using LangChain or another SDK:**
Keep using it exactly as you are. One line wraps it with AILink tracking and observability. Nothing underneath changes.

```typescript
// Your existing LangChain chain — not touching this
const chain = prompt.pipe(model).pipe(new StringOutputParser())

// Wrap it with AILink — one line, nothing changes
const wrapped = ai.wrap(chain.invoke.bind(chain), {
  toolName: 'ProductRagChain',
  role: 'admin'
})

// Call it exactly as before — now tracked through AILink
const result = await wrapped({ question: 'What is the return policy?' })
```

**Want to add a new SDK to your existing project:**
Register your existing functions with `ai.register()` as normal. Wrap the new SDK's function with `ai.wrap()`. Both work together. Zero rewrites anywhere.

```typescript
// Your existing functions — registered as normal, not touched
ai.register('checkStock', async ({ productId }) => checkStock(productId), {
  description: 'Check stock levels',
  parameters: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] }
})

// New SDK function — wrapped with ai.wrap(), registered as a tool
const searchDocs = ai.wrap(retriever.getRelevantDocuments.bind(retriever), {
  toolName: 'DocumentSearch'
})

// Both work together — AI picks which to call
const result = await ai.run('Check stock for laptop-001 and find the return policy')
```

Simple mode — zero configuration, works immediately:
```typescript
const wrapped = ai.wrap(anyAsyncFunction)
```

`WrapOptions`:

| Field | Type | Default | Description |
|---|---|---|---|
| `toolName` | `string` | `fn.name` or `'anonymous'` | Name shown on AILink dashboard. Always set this when wrapping `.bind()` calls — `.bind()` destroys the native function name |
| `role` | `RoleName` | `'user'` | Role used for tracking context only — not access control |

---

### Multi-Provider Support

Switch between OpenAI, Claude, Groq, and Gemini by changing one line. Your registered functions never change.

```typescript
// Using Groq
const ai = new AILink({ provider: 'groq', providerKey: process.env.GROQ_KEY! })

// Using OpenAI — everything else stays the same
const ai = new AILink({ provider: 'openai', providerKey: process.env.OPENAI_KEY! })
```

---

### Fallback Providers

If the primary provider fails, AILink automatically tries the next one.

```typescript
const ai = new AILink({
  provider: 'openai',
  providerKey: process.env.OPENAI_KEY!,
  providerKeys: {
    claude: process.env.CLAUDE_KEY!,
    groq: process.env.GROQ_KEY!
  },
  fallback: ['claude', 'groq'],
  retries: 3,
  retryDelay: 1000,
  platformKey: 'your-key'
})
```

---

### Role-Based Access Control

Restrict which tools each role can call. Three built-in roles: `user`, `admin`, `developer`.

```typescript
ai.register('viewData', async () => getData(), {
  description: 'View public data',
  parameters: { type: 'object', properties: {} },
  roles: ['user', 'admin', 'developer']  // everyone
})

ai.register('updateSettings', async (args) => updateSettings(args), {
  description: 'Update system settings',
  parameters: { type: 'object', properties: { setting: { type: 'string' } } },
  roles: ['admin', 'developer']  // admin and above only
})

ai.register('deleteAllData', async () => deleteAll(), {
  description: 'Delete all data',
  parameters: { type: 'object', properties: {} },
  roles: ['developer']  // developer only
})

// Pass the role at runtime
await ai.run('Update the settings', { userRole: 'admin' })    // allowed
await ai.run('Delete all data', { userRole: 'user' })         // blocked
```

> **Note:** AILink trusts the role you pass in. Verifying that a user is actually that role is your responsibility. AILink is a tool orchestration layer, not an authentication system.

**Default behavior:** If `roles` is not specified, the tool is available to all roles.

---

### Group Filtering

Organize tools into logical groups. Only expose the tools relevant to each request.

```typescript
ai.register('checkStock', async (args) => checkInventory(args), {
  description: 'Check stock levels',
  parameters: { type: 'object', properties: { productId: { type: 'string' } } },
  group: 'inventory'
})

ai.register('processRefund', async (args) => refund(args), {
  description: 'Process a customer refund',
  parameters: { type: 'object', properties: { orderId: { type: 'string' } } },
  group: 'payments'
})

// Only inventory tools are available for this request
await ai.run('How many laptops are in stock?', { groups: ['inventory'] })

// Only payment tools
await ai.run('Process a refund for order-123', { groups: ['payments'] })

// Multiple groups
await ai.run('Check stock and process refund', { groups: ['inventory', 'payments'] })
```

---

### Session Memory

Use `createSession()` for multi-turn conversations. The AI remembers previous messages.

```typescript
const session = ai.createSession()

await session.run('My name is Jay and I work at Acme Corp')
await session.run('I want to order 5 laptops')
const result = await session.run('What is the total cost and who is placing the order?')
// → AI remembers the name, company, and order from previous turns
console.log(result.response)
```

> **Important:** Session history is stored in memory. A server restart will clear all active sessions. If you need sessions to survive restarts, save `session.getHistory()` to a database and restore it with `ai.createSession(sessionId, maxTurns, savedHistory)`.

**Save and restore sessions:**

```typescript
// Save
const history = session.getHistory()
const sessionId = session.sessionId
// Store both in your database

// Restore later
const restored = ai.createSession(sessionId, 50, savedHistory)
await restored.run('Continue from where we left off')
```

**Session options:**

```typescript
ai.createSession(
  sessionId?,       // Custom ID — auto-generated if not provided
  maxTurns?,        // Max turns to keep in memory. Default: 50. Older turns are pruned automatically.
  initialHistory?   // Restore a saved session
)
```

---

### Parallel Tool Execution

When the AI decides to call multiple tools, AILink runs them simultaneously.

```typescript
ai.register('fetchUser', async ({ userId }) => getUser(userId), { ... })
ai.register('fetchOrders', async ({ userId }) => getOrders(userId), { ... })
ai.register('fetchPayments', async ({ userId }) => getPayments(userId), { ... })

// All three run in parallel automatically
const result = await ai.run('Give me the full profile for user-123')
```

---

### Usage Tracking

Every `ai.run()` call and every `ai.wrap()` call logs usage data asynchronously in the background. Logs include: prompt, tools called, provider used, execution time, role, and groups. For `run()` calls, session ID is also logged. For `wrap()` calls, session ID is always `null` — `wrap()` has no session context.

Use `platformUrl` to send logs to any server or dashboard you choose:

```typescript
const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!,
  platformUrl: 'https://your-dashboard.com/logs',
  platformKey: 'your-dashboard-key'
})
```

If `platformUrl` is not set, logging is skipped. The AILink platform dashboard is currently in development — when it launches, you will receive a `platformUrl` and `platformKey` from your AILink account.

Logging always fails silently and never affects your application.

---

### Configurable Iteration Limit

Control how many tool-call loops the engine runs before stopping.

```typescript
const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!,
  platformKey: 'your-key',
  maxIterations: 5  // default is 10
})
```

---

### Chat Widget

Drop a chat interface into any web page.

**Plain HTML:**
```html
<div
  id="ailink-widget"
  data-provider="groq"
  data-provider-key="your-groq-key"
  data-title="AI Assistant"
  data-position="bottom-right"
></div>
<script src="./dist/widget/AILinkScript.js"></script>
```

**React:**
```tsx
import { AILinkWidget } from '@ailink/sdk/widget'

export default function App() {
  return (
    <AILinkWidget
      provider="groq"
      providerKey={process.env.REACT_APP_GROQ_KEY!}
      title="AI Assistant"
    />
  )
}
```

---

### Managing Tools

List all registered tool names:

```typescript
const names = ai.tools()
// → ['checkStock', 'processRefund', 'getWeather']
```

Remove a registered tool at runtime:

```typescript
ai.unregister('getWeather')
// The tool is immediately removed from the registry.
// Any subsequent ai.run() call will no longer have access to it.
```

---

## Configuration Reference

```typescript
const ai = new AILink({
  // Required
  provider: 'openai' | 'claude' | 'groq' | 'gemini',
  providerKey: string,       // Your provider API key

  // Optional
  platformKey?: string,      // Auth key for your logging platform. Optional.
  model?: string,            // Override the default model for your provider
  providerKeys?: {           // API keys for fallback providers
    openai?: string,
    claude?: string,
    groq?: string,
    gemini?: string
  },
  fallback?: ProviderName[],    // Fallback providers in order of preference
  retries?: number,             // Retry attempts per provider. Default: 3
  retryDelay?: number,          // Delay between retries in ms. Default: 1000
  maxIterations?: number,       // Max tool-call loop iterations. Default: 10
  debug?: boolean,              // Log engine calls to console. Default: false
  environment?: 'development' | 'staging' | 'production',
  platformUrl?: string          // Send usage logs to your own server or dashboard
})
```

### Default Models

| Provider | Default Model |
|----------|---------------|
| OpenAI | `gpt-4o-mini` |
| Claude | `claude-3-5-haiku-latest` |
| Groq | `llama-3.3-70b-versatile` |
| Gemini | `gemini-1.5-flash` |

---

## Result Object

Every `ai.run()` and `session.run()` returns:

```typescript
{
  response: string        // The AI's final natural language response
  toolsCalled: string[]   // Names of tools that were called
  allowedTools: string[]  // Names of tools that were available for this request
  executionTime: number   // Total time in milliseconds
  provider: ProviderName  // Which provider was used (may differ from primary if fallback triggered)
  userRole: RoleName      // Role used for this request
  groups: string[] | null // Groups used for filtering, or null if none specified
}
```

---

## Error Handling

```typescript
import {
  AILinkConfigError,
  AllProvidersFailedError,
  EmptyGroupError,
  ToolAlreadyExistsError,
  ToolNotFoundError,
  ValidationError,
  ToolExecutionError,
  UnsupportedProviderError
} from '@ailink/sdk'

try {
  const result = await ai.run('User request')
  console.log(result.response)
} catch (error) {
  if (error instanceof AILinkConfigError) {
    // Missing or invalid configuration
  } else if (error instanceof AllProvidersFailedError) {
    // Primary provider and all fallbacks failed
  } else if (error instanceof EmptyGroupError) {
    // No tools found for the specified groups
  } else if (error instanceof ValidationError) {
    // AI passed invalid arguments to a tool
  }
}
```

---

## Project Structure

```
src/
├── index.ts          — Exports
├── ailink.ts         — Main AILink class
├── engine.ts         — Tool-call loop
├── session.ts        — Conversation memory
├── registry.ts       — Function registration
├── validator.ts      — JSON Schema validation
├── tracker.ts        — Usage tracking
├── types.ts          — TypeScript types
├── errors.ts         — Error classes
├── providers/        — Provider adapters
│   ├── openai.ts
│   ├── claude.ts
│   ├── groq.ts
│   └── gemini.ts
└── widget/           — Chat widget
    ├── AILinkWidget.tsx
    └── AILinkScript.ts
```

---

## Testing

```bash
npm test                    # All tests
npm run test:unit           # Unit tests only (~5s)
npm run test:integration    # Integration tests
npm run test:e2e            # End-to-end tests
npm run test:coverage       # Coverage report
```

---

## Common Patterns

**Express backend:**
```typescript
import { AILink } from '@ailink/sdk'

const ai = new AILink({ provider: 'groq', providerKey: process.env.GROQ_KEY! })

// Register your existing functions
ai.register('getOrder', async ({ orderId }) => db.orders.find(orderId), {
  description: 'Get order details by order ID',
  parameters: {
    type: 'object',
    properties: { orderId: { type: 'string' } },
    required: ['orderId']
  }
})

app.post('/chat', async (req, res) => {
  const result = await ai.run(req.body.message, { userRole: req.user.role })
  res.json({ response: result.response })
})
```

**Session with Express:**
```typescript
const sessions = new Map()

app.post('/chat/:sessionId', async (req, res) => {
  let session = sessions.get(req.params.sessionId)
  if (!session) {
    session = ai.createSession(req.params.sessionId)
    sessions.set(req.params.sessionId, session)
  }
  const result = await session.run(req.body.message)
  res.json({ response: result.response })
})
```

**Debug mode:**
```typescript
const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!,
  debug: true  // logs all engine calls to console
})
```

---

## FAQ

**Do I need to rewrite my existing code?**
No. Register your existing functions as-is. AILink calls them — you don't modify them.

**Which provider should I start with?**
Groq — free tier, no credit card required, fast inference. Get a key at console.groq.com.

**Can I use multiple providers?**
Yes. Set a primary provider and configure fallbacks. AILink switches automatically if the primary fails.

**Are sessions persistent across server restarts?**
No. Sessions are in-memory. Save `session.getHistory()` to a database if you need persistence.

**Who verifies that a user has a certain role?**
You do, before calling AILink. AILink trusts the role you pass in — it does not authenticate users.

**What if I call a group that has no tools?**
AILink throws `EmptyGroupError` immediately, before making any provider calls.

**What happens when maxIterations is reached?**
The engine stops the loop and returns whatever response it has. No crash, no hanging.

**Can I use LangChain, Vercel AI SDK, or any other SDK alongside AILink?**
Yes. Use `ai.wrap()` to wrap any async function from any SDK. Your existing code stays exactly as it is. Their code stays exactly as it is. AILink sits on top of everything. No rewrites. No restructuring. Any SDK. Any function. Zero changes.

---

## Troubleshooting

**`AILinkConfigError: providerKey is required`**
You're missing the provider API key in your config.

**`AllProvidersFailedError`**
Your API key is invalid or expired, or you've hit a rate limit. Check your provider's dashboard.

**`EmptyGroupError`**
You passed a group name that has no tools registered to it. Check your group names in `ai.register()`.

**Tests timing out**
Provider integration tests make real API calls. Use `npm run test:unit` for fast local testing.

---

## License

MIT — free to use in commercial and personal projects.

---

## Contributing

Issues and pull requests are welcome at [github.com/getailink/ailink-sdk](https://github.com/getailink/ailink-sdk).
