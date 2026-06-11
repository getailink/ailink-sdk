# AILink SDK — Internal Architecture Reference

## Overview

AILink implements a **decoupled middleware layer** between LLM inference backends and native TypeScript function code. Three core patterns:

1. **Registry Pattern**: Centralized tool catalog with role/group filtering
2. **Proxy Pattern**: Higher-order functions intercept execution without modification
3. **Adapter Pattern**: Provider implementations (OpenAI, Claude, Groq, Gemini) behind uniform interface

---

## Registry Pattern

### FunctionRegistry

Central tool store. Stores all registered functions with metadata.

**Key responsibilities:**
- Store tool definitions (schema, executor, roles, group)
- Compile JSON Schema validators once per registration (Ajv)
- Filter tools by role hierarchy
- Filter tools by group membership
- Prevent duplicate tool names

**Location:** `src/registry.ts`

```typescript
export class FunctionRegistry {
  private tools: Map<string, AILinkTool>

  register(name, description, schema, execute, options): void
  unregister(name): void
  get(name): AILinkTool | undefined
  list(): string[]
  getAll(): AILinkTool[]
  getByRole(role: RoleName): AILinkTool[]
  getByGroups(groups?: string[]): AILinkTool[]
}
```

**AILinkTool structure:**

```typescript
interface AILinkTool {
  name: string
  description: string
  schema: Record<string, any>              // JSON Schema
  execute: (args: any) => Promise<any>
  roles: RoleName[]
  group?: string
  compiledValidator?: (args: any) => boolean  // Pre-compiled Ajv validator
}
```

**Role hierarchy:**

- `'user'`: Tools where `roles.includes('user')`
- `'admin'`: Tools where `roles.includes('admin')` OR `roles.includes('user')`
- `'developer'`: All tools

**Optimization:** JSON Schema validators are compiled once at registration via Ajv singleton. Reused for every tool invocation.

---

## Proxy Pattern

### ai.wrap()

Higher-order function that applies transparent middleware to any async function.

**Signature-preserving:** Wrapped function has identical argument types and return type as original.

**Mechanics:**

1. Accept async function `fn` with argument type `TArgs` and return type `TReturn`
2. Capture execution start time
3. Call original function with unmodified arguments
4. Log telemetry (time, provider, role, tool name)
5. Return result identically
6. On error: log error telemetry, re-throw

```typescript
wrap<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: WrapOptions
): (...args: TArgs) => Promise<TReturn>
```

**Use cases:**

- Wrap LangChain chains: `ai.wrap(chain.invoke.bind(chain), { toolName: 'ProductChain' })`
- Wrap Vercel AI functions
- Wrap any external SDK's async method

**Telemetry logged:**

```typescript
interface UsageLog {
  prompt: string           // toolName or function name
  toolsCalled: string[]    // [functionName]
  allowedTools: string[]   // [functionName]
  provider: ProviderName   // provider in use
  executionTime: number    // milliseconds
  success: boolean
  error?: string
  timestamp: ISO 8601
  sessionId: string | null // null — wrap() has no session context
  userRole: RoleName       // 'user' by default
  groups: null             // wrap() has no group context
  environment: string | null // from AILink config
  model: string            // resolved model name
  promptTokens: null       // wrap() has no token data — always null
  completionTokens: null   // wrap() has no token data — always null
}
```

**Location:** `src/ailink.ts` (AILink.wrap method)

---

## Adapter Pattern

### Provider Interface

All providers (OpenAI, Claude, Groq, Gemini) implement uniform interface:

```typescript
interface Provider {
  run(
    prompt: string,
    tools: ToolDefinition[],
    conversationHistory: Message[]
  ): Promise<ProviderResponse>
}
```

**ToolDefinition format:** OpenAI tool_call spec (JSON Schema + description)

**ProviderResponse variants:**

```typescript
type ProviderResponse =
  | { type: 'text', text: string, promptTokens?: number | null, completionTokens?: number | null }
  | { type: 'tool_call', toolName: string, toolArgs: Record<string, any>, promptTokens?: number | null, completionTokens?: number | null }
  | { type: 'tool_calls', toolCalls: ToolCall[], promptTokens?: number | null, completionTokens?: number | null }
```

**Provider implementations:**

- `src/providers/openai.ts`: OpenAI gpt-4o-mini (default)
- `src/providers/claude.ts`: Anthropic Claude 3.5 Haiku
- `src/providers/groq.ts`: Groq Llama 3.3 70B
- `src/providers/gemini.ts`: Google Gemini 1.5 Flash

**Provider selection:** At AILink initialization. Fallback providers specified in `fallback` array.

---

## Engine: Tool-Call Loop

### Execution Flow

**Location:** `src/engine.ts`

1. **Input:** User prompt, tool registry, conversation history
2. **Loop (up to maxIterations times):**
   - Send prompt + tools to provider
   - Receive response (text or tool_call(s))
   - If text response: return to user
   - If tool_call(s):
     - Validate arguments against JSON Schema
     - Execute tool(s) in parallel
     - Append tool results to history
     - Loop again (provider reads history, makes next decision)
3. **Termination:** Max iterations reached or text response returned
4. **Output:** AILinkResult (response, tools called, execution time, provider, token usage)

**Parallel execution:** Multiple tool_calls handled concurrently via `Promise.all()`.

**Error recovery:**
- **Validation error:** Tool arguments don't match schema → AILink re-prompts provider
- **Tool execution error:** Exception thrown → Logged but loop continues (provider decides next step)
- **Provider error:** Fallback providers tried in order; all fail → `AllProvidersFailedError`

---

## Session Management

### AILinkSession

Stateful multi-turn conversation.

**Location:** `src/session.ts`

**Responsibilities:**
- Maintain conversation history (User → Assistant → Tool)
- Prune old turns (keeping last `maxTurns` messages)
- Restore from saved history

**State structure:**

```typescript
interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  toolArgs?: Record<string, any>
  toolResult?: any
}
```

**Session lifecycle:**

```typescript
const session = ai.createSession(sessionId?, maxTurns?, initialHistory?)

await session.run('First message')
await session.run('Second message (AI remembers first)')

const history = session.getHistory()
const id = session.sessionId
// Save to database

// Restore later
const restored = ai.createSession(id, 50, savedHistory)
```

**Turn pruning:** When history length exceeds `maxTurns`, oldest non-system messages are removed.

---

## Validation

### JSON Schema Validation

**Location:** `src/validator.ts`

Single Ajv instance shared across all tool registrations. Schemas compiled once at registration.

**Why Ajv:** Fast validation, compiled schemas are ~10x faster than runtime validation.

**Validation flow:**

1. Tool registered with JSON Schema
2. Schema compiled via `ajv.compile(schema)` → validator function
3. Stored in `AILinkTool.compiledValidator`
4. At execution: `compiledValidator(toolArgs)` returns boolean
5. On failure: Provide error list to provider for re-prompting

**Custom formats supported:** date-time, uuid, email (via Ajv defaults)

---

## Telemetry & Tracking

### Tracker

Logs usage data asynchronously without blocking execution.

**Location:** `src/tracker.ts`

**What's logged:**

- User prompt
- Unique request ID (generated per log entry)
- Tools called
- Tools available (for filtering context)
- Provider used
- Model name
- Execution time
- Token usage (prompt tokens and completion tokens)
- User role
- Session ID
- Groups used
- Environment (development / staging / production)
- Success/failure status
- Timestamp

**Transport:** HTTP POST to `platformUrl` (if configured). Failures are silent; never blocks application.

**Headers:**

```
Authorization: Bearer {platformKey}
Content-Type: application/json
```

**Payload:**

```typescript
{
  id: string               // Unique identifier — generated per log entry
  prompt: string
  toolsCalled: string[]
  allowedTools: string[]
  provider: ProviderName
  executionTime: number
  success: boolean
  error: string | null
  timestamp: ISO 8601
  sessionId: string | null
  userRole: RoleName
  groups: string[] | null
  environment: string | null
  model: string
  promptTokens: number | null
  completionTokens: number | null
}
```

---

## Type System

**Location:** `src/types.ts`

Key exports:

```typescript
type ProviderName = 'openai' | 'claude' | 'groq' | 'gemini'
type RoleName = 'user' | 'admin' | 'developer'

interface AILinkConfig { ... }
interface ToolOptions { ... }
interface RunOptions { ... }
interface AILinkResult { ... }
interface WrapOptions { ... }
```

---

## Error Taxonomy

**Location:** `src/errors.ts`

Each error is catchable and descriptive:

- `AILinkConfigError`: Missing or invalid config (e.g., missing providerKey)
- `AllProvidersFailedError`: Primary and fallbacks all failed
- `EmptyGroupError`: No tools match the groups filter
- `ToolAlreadyExistsError`: Duplicate tool name
- `ToolNotFoundError`: Tool called but not registered
- `ValidationError`: LLM passed invalid arguments to a tool
- `ToolExecutionError`: Exception during tool execution
- `UnsupportedProviderError`: Unknown provider name

---

## Widget: Chat UI

**Location:** `src/widget/`

### AILinkWidget (React)

React component for embedding chat interface. Manages:
- User input form
- Message history display
- Connection to backend endpoint

### AILinkScript (Vanilla JS)

Standalone script loader. Injects chat widget into any HTML page via `<script>` tag.

---

## Testing Strategy

**Location:** `src/__tests__/`

### Unit Tests

Fast, isolated tests of individual functions. No external API calls.

- Registry filtering logic
- Validator behavior
- Error handling
- Session history pruning

### Integration Tests

Provider adapters tested against real API keys (Groq free tier preferred).

- Tool invocation end-to-end
- Multi-turn conversation
- Fallback provider switching

### E2E Tests

Full workflow tests. User prompt → tool execution → result.

---

## Performance Characteristics

### Latency

- **Registry lookup:** O(1) hash map
- **Schema validation:** O(1) pre-compiled validators
- **Tool execution:** Network-bound (provider inference + tool runtime)
- **Parallel execution:** N tools → max(tool_time), not sum

### Memory

- **Registry:** ~1KB per registered tool (schema + metadata)
- **Session history:** O(maxTurns × message_size). Default maxTurns: 50. Typical message: ~500 bytes → ~25KB per session
- **Active sessions:** Unbounded; pruning is manual or application-managed

### Optimization Opportunities

1. Implement distributed session storage (Redis) for horizontal scaling
2. Add response caching for deterministic queries
3. Batch multiple `ai.run()` calls for concurrent execution
