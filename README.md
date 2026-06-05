# AILink SDK

AILink is a zero-overhead, decoupled abstraction layer that connects LLM APIs to native TypeScript functions without code modification. Register existing functions once; the LLM invokes them directly via a proxy pattern. Multi-provider support, role-based access control, session memory, and automatic fallback handling included.

**Works with:** OpenAI · Claude · Groq · Gemini | **Requires:** Node.js 18+

```bash
npm install @ailink/sdk
```

---

## How It Works

`ai.wrap()` and `ai.register()` implement a **higher-order function proxy**. When invoked:

1. **Argument interception**: Function arguments are captured before execution
2. **Latency & telemetry logging**: Execution time, provider, role, and toolset logged to the registry
3. **Transparent invocation**: Original function executes unmodified; return type preserved
4. **Result passthrough**: Output returned identically; callers see no behavioral difference

**Example:**

```typescript
import { AILink } from '@ailink/sdk'

const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!
})

// Your existing function — untouched
async function getWeather(city: string): Promise<string> {
  return `22°C and sunny in ${city}`
}

// Proxy wrapper: Higher-order function intercepts execution
const weatherTool = async ({ city }: { city: string }) => getWeather(city)

ai.register('getWeather', weatherTool, {
  description: 'Retrieve current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' }
    },
    required: ['city']
  }
})

// LLM calls via proxy — telemetry logged automatically
const result = await ai.run('What is the weather in Tokyo?')
console.log(result.response)
// → "It's currently 22°C and sunny in Tokyo."
console.log(result.executionTime)  // milliseconds
```

---

## Core Mechanics

### Registration & Registry

Functions register into a **singleton FunctionRegistry**. Each registration stores:

- **Schema**: JSON Schema validator (compiled once via Ajv, reused across invocations)
- **Executor**: The wrapped function handler
- **Access control**: Role-based filtering (user, admin, developer)
- **Grouping**: Logical tool categories for filtering at runtime

```typescript
ai.register('checkStock', async ({ productId }) => {
  return db.inventory.check(productId)
}, {
  description: 'Check inventory for a product',
  parameters: {
    type: 'object',
    properties: {
      productId: { type: 'string', description: 'Product ID' }
    },
    required: ['productId']
  },
  roles: ['admin', 'developer'],
  group: 'inventory'
})
```

### Wrapping External SDKs

`ai.wrap()` applies proxy middleware to any async function from any external SDK (LangChain, Vercel AI, Hugging Face) **without modifying that SDK's code**. Execution remains identical; telemetry is logged in-band.

```typescript
// LangChain chain — existing code unchanged
const chain = prompt.pipe(model).pipe(new StringOutputParser())

// Proxy wraps the invoke method — no changes to chain implementation
const wrapped = ai.wrap(chain.invoke.bind(chain), {
  toolName: 'ProductRagChain',
  role: 'admin'
})

// Call signature identical to original — transparent proxy
const result = await wrapped({ question: 'What is the return policy?' })
```

### Multi-Provider Adapter Pattern

Provider implementations (OpenAI, Claude, Groq, Gemini) implement a **consistent interface**:

```typescript
interface Provider {
  run(prompt: string, tools: ToolDefinition[], history: Message[]): Promise<ProviderResponse>
}
```

Switch providers by changing one line; registered functions and tool invocation remain unchanged:

```typescript
// Provider switch — zero impact on registered tools
const ai = new AILink({ provider: 'openai', providerKey: process.env.OPENAI_KEY! })
// Same functions, same API, different inference backend
```

### Role-Based Access Control

Three roles with hierarchical filtering:

- **user**: Tools marked `roles: ['user', ...]` only
- **admin**: Tools marked `roles: ['admin', ...]` or `roles: ['user', ...]`
- **developer**: All tools

```typescript
ai.register('deleteAllData', async () => deleteAll(), {
  // ...
  roles: ['developer']  // developer role only
})

await ai.run('Delete everything', { userRole: 'developer' })  // allowed
await ai.run('Delete everything', { userRole: 'user' })       // blocked
```

Role verification is your responsibility; AILink is a tool orchestration layer, not an authentication system.

### Group Filtering

Organize tools into logical categories. Only expose relevant tools per request:

```typescript
ai.register('checkStock', ..., { group: 'inventory' })
ai.register('processRefund', ..., { group: 'payments' })

// Only inventory tools available
await ai.run('How many laptops?', { groups: ['inventory'] })
```

### Session Memory

Stateful conversation with multi-turn memory. Messages accumulate; older turns pruned automatically:

```typescript
const session = ai.createSession()

await session.run('My name is Jay and I work at Acme Corp')
await session.run('I want 5 laptops')
const result = await session.run('Who is placing the order and for how many units?')
// → AI recalls name, company, quantity from previous turns
```

Sessions are in-memory. Persist via `session.getHistory()` to a database if restarts must preserve state:

```typescript
const history = session.getHistory()
const sessionId = session.sessionId
// Store to database

// Restore later
const restored = ai.createSession(sessionId, 50, savedHistory)
await restored.run('Continue the conversation')
```

### Parallel Tool Execution

When the LLM decides to call multiple tools, AILink executes them concurrently:

```typescript
ai.register('fetchUser', async ({ userId }) => db.users.get(userId), { ... })
ai.register('fetchOrders', async ({ userId }) => db.orders.get(userId), { ... })
ai.register('fetchPayments', async ({ userId }) => db.payments.get(userId), { ... })

// All three run in parallel automatically
const result = await ai.run('Get full profile for user-123')
```

### Usage Telemetry

Every `ai.run()` and `ai.wrap()` invocation logs asynchronously:

```
{
  prompt: string           // User input
  toolsCalled: string[]    // Tools invoked by LLM
  allowedTools: string[]   // Tools available for filtering
  provider: string         // Provider used (may differ if fallback triggered)
  executionTime: number    // Total milliseconds
  userRole: string         // Role for context
  timestamp: ISO 8601
}
```

Ship logs to your own dashboard:

```typescript
const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!,
  platformUrl: 'https://your-dashboard.com/logs',
  platformKey: 'your-key'
})
```

Logging fails silently and never affects application logic.

---

## Configuration

```typescript
const ai = new AILink({
  // Required
  provider: 'openai' | 'claude' | 'groq' | 'gemini',
  providerKey: string,

  // Optional
  platformKey?: string,
  platformUrl?: string,
  model?: string,
  providerKeys?: {
    openai?: string,
    claude?: string,
    groq?: string,
    gemini?: string
  },
  fallback?: ProviderName[],
  retries?: number,              // Default: 3
  retryDelay?: number,           // Default: 1000 ms
  maxIterations?: number,        // Default: 10
  debug?: boolean,               // Default: false
  environment?: 'development' | 'staging' | 'production'
})
```

### Default Models

| Provider | Model |
|----------|-------|
| OpenAI | `gpt-4o-mini` |
| Claude | `claude-3-5-haiku-latest` |
| Groq | `llama-3.3-70b-versatile` |
| Gemini | `gemini-1.5-flash` |

---

## API Reference

### `ai.register(name, execute, options)`

Register an async function as an LLM-callable tool.

```typescript
ai.register('toolName', async (args) => {
  // args is { param1, param2, ... } based on parameters schema
  return result
}, {
  description: 'What this tool does',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' }
    },
    required: ['param1']
  },
  roles?: ['user', 'admin', 'developer'],
  group?: 'logical_category'
})
```

### `ai.wrap(fn, options?)`

Wrap any async function with transparent proxy logging.

```typescript
const wrapped = ai.wrap(anyAsyncFunction, {
  toolName: 'string',  // Dashboard display name. Required for .bind() calls.
  role?: 'user' | 'admin' | 'developer'  // Tracking context only. Default: 'user'
})

// Wrapped function has identical signature and behavior as original
const result = await wrapped(...originalArgs)
```

### `ai.run(prompt, options?)`

Send a user prompt to the LLM. LLM invokes registered tools as needed.

```typescript
const result = await ai.run('User query', {
  userRole?: 'user' | 'admin' | 'developer',
  groups?: ['group1', 'group2'],
  conversationHistory?: Message[]  // Set automatically by sessions
})

// Returns
{
  response: string,        // LLM's natural language response
  toolsCalled: string[],   // Tools LLM invoked
  allowedTools: string[],  // Tools available for filtering
  executionTime: number,   // Milliseconds
  provider: string,        // Provider used
  userRole: string,        // Role passed in
  groups: string[] | null
}
```

### `ai.createSession(sessionId?, maxTurns?, initialHistory?)`

Create a stateful conversation with multi-turn memory.

```typescript
const session = ai.createSession(
  undefined,  // sessionId — auto-generated if omitted
  50,         // maxTurns — older turns pruned automatically
  []          // initialHistory — for session restore
)

const result = await session.run('User message')
// Same result type as ai.run()

const history = session.getHistory()
const id = session.sessionId
// Save history and id to database for persistence
```

### `ai.tools()`

List all registered tool names.

```typescript
const toolNames = ai.tools()
// → ['checkStock', 'processRefund', 'getWeather']
```

### `ai.unregister(name)`

Remove a tool from the registry at runtime.

```typescript
ai.unregister('getWeather')
// Tool immediately unavailable for subsequent ai.run() calls
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
  const result = await ai.run('User query')
} catch (error) {
  if (error instanceof AILinkConfigError) {
    // Missing or invalid configuration
  } else if (error instanceof AllProvidersFailedError) {
    // Primary and all fallbacks exhausted
  } else if (error instanceof EmptyGroupError) {
    // No tools for specified groups
  } else if (error instanceof ValidationError) {
    // LLM passed invalid arguments to a tool
  } else if (error instanceof ToolExecutionError) {
    // Tool threw an exception during execution
  }
}
```

---

## Project Structure

```
src/
├── index.ts              — Public exports
├── ailink.ts             — Main AILink class (register, wrap, run, createSession)
├── engine.ts             — Tool-call execution loop
├── session.ts            — Stateful conversation management
├── registry.ts           — Function registry with role/group filtering
├── validator.ts          — JSON Schema validation (Ajv)
├── tracker.ts            — Usage telemetry logging
├── types.ts              — TypeScript interfaces
├── errors.ts             — Error classes
├── providers/            — Provider adapters
│   ├── openai.ts
│   ├── claude.ts
│   ├── groq.ts
│   └── gemini.ts
└── widget/               — Chat UI widget
    ├── AILinkWidget.tsx
    └── AILinkScript.ts
```

---

## Testing

```bash
npm test                   # All tests
npm run test:unit          # Unit tests only
npm run test:integration   # Provider integration tests
npm run test:e2e           # End-to-end tests
npm run test:coverage      # Coverage report
```

Unit tests run locally without external API calls (~5 seconds).  
Integration tests make real provider API calls; set `GROQ_KEY`, `OPENAI_KEY`, `CLAUDE_KEY`, `GEMINI_KEY` environment variables.

---

## Common Patterns

### Express Backend with Role-Based Access

```typescript
import { AILink } from '@ailink/sdk'
import express from 'express'

const ai = new AILink({ provider: 'groq', providerKey: process.env.GROQ_KEY! })

ai.register('getOrder', async ({ orderId }) => db.orders.find(orderId), {
  description: 'Retrieve order by ID',
  parameters: {
    type: 'object',
    properties: { orderId: { type: 'string' } },
    required: ['orderId']
  },
  roles: ['user', 'admin']
})

const app = express()

app.post('/chat', async (req, res) => {
  try {
    const result = await ai.run(req.body.message, {
      userRole: req.user.role  // Verify req.user.role yourself
    })
    res.json({ response: result.response })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(3000)
```

### Session-Based Multi-Turn Conversation

```typescript
const sessions = new Map<string, AILinkSession>()

app.post('/chat/:sessionId', async (req, res) => {
  let session = sessions.get(req.params.sessionId)
  if (!session) {
    session = ai.createSession(req.params.sessionId)
    sessions.set(req.params.sessionId, session)
  }

  const result = await session.run(req.body.message)
  res.json({ response: result.response, sessionId: session.sessionId })
})
```

### Debug Mode

```typescript
const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!,
  debug: true  // Logs all engine calls to console
})
```

---

## FAQ

**Do I need to rewrite my existing code?**  
No. Register existing functions as-is. AILink calls them unchanged.

**Which provider should I use?**  
Groq — free tier, no credit card, fast inference. Get key at console.groq.com.

**Can I use multiple providers?**  
Yes. Set primary provider and configure fallbacks. AILink switches automatically on failure.

**Are sessions persistent across restarts?**  
No. Sessions are in-memory. Save `session.getHistory()` to a database if persistence is required.

**Who verifies user roles?**  
You do, before calling AILink. AILink trusts the role you pass; it does not authenticate.

**What if I call a group with no tools?**  
AILink throws `EmptyGroupError` immediately, before any provider calls.

**Can I wrap LangChain, Vercel AI, or other SDKs?**  
Yes. Use `ai.wrap()` on any async function. Original code stays unchanged; AILink adds transparent proxy logging.

---

## License

MIT
