# AILink — How It Works

This document explains the internal architecture of the AILink SDK for developers who want to understand what happens under the hood.

---

## The Core Idea

Most AI SDKs make you fit your code to the AI. AILink does the opposite — the AI fits your code.

You register your existing functions once. When a user sends a natural language prompt, AILink handles everything: sending the prompt to the AI, executing the functions the AI requests, feeding results back to the AI, and returning the final response. Your functions are never modified.

---

## What Changes vs What Stays the Same

```
Before AILink                    After AILink

Your functions                   Your functions (unchanged)
     ↓                                ↓
Direct API calls           →     ai.register() — one time setup
     ↓                                ↓
Response                         ai.run('natural language')
                                       ↓
                                 AI decides which functions to call
                                       ↓
                                 AILink executes them
                                       ↓
                                 Natural language response
```

---

## Execution Flow

When you call `ai.run(prompt)`, this is the exact sequence:

```
1. Role and group filtering
   → AILink filters the registered tools down to only
     those the current user role and group can access

2. Tool schemas sent to AI
   → AILink sends the prompt + allowed tool descriptions
     to the AI provider

3. AI decides what to call
   → The AI returns either a final text response
     or a list of tool calls to execute

4. Parallel tool execution
   → If the AI requests multiple tools, AILink runs
     them simultaneously

5. Results fed back to AI
   → Tool results are added to the conversation history
     and sent back to the AI

6. Loop repeats
   → Steps 3-5 repeat until the AI returns a final
     text response or maxIterations is reached

7. Tracking
   → Usage is logged asynchronously in the background
     without blocking the response
```

---

## Components

### AILink (ailink.ts)
The main class developers interact with. Handles initialization, provider setup, fallback logic, retry logic, and exposes `register()`, `run()`, `wrap()`, `createSession()`, `tools()`, and `unregister()`.

### Engine (engine.ts)
Runs the agentic loop. Receives a prompt and tool list, communicates with the provider, executes tools in parallel when needed, and returns the final result. Respects `maxIterations` to prevent infinite loops.

### FunctionRegistry (registry.ts)
Stores all registered tools. Handles role and group filtering via `getFiltered(role, groups)`. Each tool is stored with its name, description, JSON Schema, execute function, roles, and group.

### Validator (validator.ts)
Pre-compiles an Ajv validator for each tool's JSON Schema at registration time. Validates arguments before execution — invalid arguments are caught before your function runs.

### AILinkSession (session.ts)
Maintains conversation history across multiple `run()` calls. Automatically prunes old messages when `maxTurns` is exceeded. Supports saving history to a database and restoring it later.

> Session history is stored in memory. A server restart clears all sessions. Save `session.getHistory()` to a database if you need sessions to survive restarts.

### Tracker (tracker.ts)
Sends usage logs to the AILink platform after every `run()` call and every `wrap()` call. Runs asynchronously so it never slows down the response. Logs: prompt, tools called, provider used, execution time, role, groups, session ID.

### Providers (providers/)
Adapters for each AI provider. Each adapter implements the same `ProviderAdapter` interface — `initialize()` and `execute()`. The engine never knows which provider it's talking to.

---

## Role-Based Access Control

Three built-in roles: `user`, `admin`, `developer`.

When you register a tool with `roles: ['admin', 'developer']`, only requests with those roles will have that tool available. The AI never sees tools the current role cannot access — they don't appear in the tool list sent to the provider.

Role is passed at runtime:
```typescript
await ai.run('Delete all records', { userRole: 'developer' })
```

> AILink trusts the role you pass in. Verifying that a user actually has that role is your responsibility. AILink is a tool orchestration layer, not an authentication system.

**Default:** If `roles` is not specified, the tool is available to all roles.

---

## Group Filtering

Groups let you organize tools and expose only what's relevant to each request.

```typescript
ai.register('checkStock', fn, { group: 'inventory' })
ai.register('processRefund', fn, { group: 'payments' })

// Only inventory tools are in scope
await ai.run('How many laptops do we have?', { groups: ['inventory'] })
```

If you pass a group name that has no tools registered to it, AILink throws `EmptyGroupError` immediately — before making any API calls.

---

## Fallback Providers

The provider chain is: primary → fallback[0] → fallback[1] → ...

Each provider is retried `retries` times (default: 3) with exponential backoff before moving to the next. If all providers fail, `AllProvidersFailedError` is thrown.

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
  retryDelay: 1000
})
```

---

## Parallel Tool Execution

When the AI returns multiple tool calls in one response, AILink executes them all with `Promise.all()`. This is automatic — no configuration needed.

---

## Adding a Custom Provider

Implement the `ProviderAdapter` interface from `src/providers/base.ts`:

```typescript
import { ProviderAdapter } from '@ailink/sdk/providers/base'

export class MyProvider implements ProviderAdapter {
  name = 'my-provider'

  initialize(apiKey: string, model?: string): void {
    // Set up your client
  }

  async execute(history: Message[], tools: any[]): Promise<ProviderResponse> {
    // Call your provider API
    // Return { type: 'text', text: '...' } or { type: 'tool_calls', toolCalls: [...] }
  }
}
```

---

## Data Flow Diagram

```
User prompt
     ↓
AILink.run()
     ↓
Role + group filter → filtered tool list
     ↓
Provider.execute(history, tools)
     ↓
  ┌─────────────────────────────┐
  │  AI returns tool_calls?     │
  │  Yes → execute in parallel  │
  │       → append to history   │
  │       → loop back           │
  │  No  → return text response │
  └─────────────────────────────┘
     ↓
Tracker.track() [async, non-blocking]
     ↓
Return AILinkResult
```

> **Note:** `Tracker.track()` also fires for every `ai.wrap()` call — on both success and failure — with the same async, non-blocking behaviour.
