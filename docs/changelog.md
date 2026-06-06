# Changelog

All notable changes to `@ailink/sdk` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-05-29

Initial public release.

### Added

- **`AILink` class** — connects any function to AI providers (OpenAI, Claude, Groq, Gemini) through a unified API. One class, four providers, same code.

- **`register()`** — registers any async function as an AI-callable tool. Two supported signatures:
  - Preferred: `ai.register(name, execute, { description, parameters, roles?, group? })`
  - Legacy: `ai.register(name, description, schema, execute, options?)`

- **`run()`** — runs a natural language prompt through the full tool-call loop. AI picks tools, AILink executes them, returns final response.

- **Role-based access control** — restrict tools to specific roles (`user`, `admin`, `developer`). Tools outside the current role are never sent to the AI.

- **Group filtering** — organize tools into logical groups. Expose only the tools relevant to each request.

- **Parallel tool execution** — when the AI requests multiple tools, AILink executes them simultaneously with `Promise.all()`.

- **Fallback providers** — if the primary provider fails, AILink automatically tries configured fallbacks in order.

- **Automatic retries** — configurable retry count and delay per provider with exponential backoff.

- **`AILinkSession`** — multi-turn conversation with memory. Supports stable session IDs, automatic history pruning, save/restore from database.

- **`maxIterations`** — configurable limit on the tool-call loop. Default: 10.

- **Usage tracking** — every `run()` call is logged asynchronously to the AILink platform without blocking the response.

- **JSON Schema validation** — all tool arguments are validated against the registered schema before execution. Pre-compiled Ajv validators for performance.

- **Chat widget (HTML)** — drop-in chat interface via `<script>` tag with `data-` attribute configuration.

- **Chat widget (React)** — `AILinkWidget` React component with inline styles. No CSS import required.

- **Error classes** — `AILinkConfigError`, `AllProvidersFailedError`, `EmptyGroupError`, `ToolNotFoundError`, `ToolAlreadyExistsError`, `ValidationError`, `ToolExecutionError`, `UnsupportedProviderError`.

- **465 tests** — unit, integration, and end-to-end test coverage.

### Providers and Default Models

| Provider | Default Model |
|----------|---------------|
| OpenAI | `gpt-4o-mini` |
| Claude | `claude-3-5-haiku-latest` |
| Groq | `llama-3.3-70b-versatile` |
| Gemini | `gemini-1.5-flash` |

---

## [0.2.1] — 2026-06-06

### Fixed

- **Groq provider — missing `tool_choice` and `parallel_tool_calls` fields** — when tools were present, the request sent to Groq was missing the required `tool_choice: 'auto'` and `parallel_tool_calls: false` fields that llama models expect. Without these, some llama model variants would ignore the tool list entirely or behave inconsistently across requests. Both fields are now included whenever `tools.length > 0` and omitted entirely when no tools are present. The fix is conditional — zero-tool requests are not affected.

- **Claude provider — assistant tool-call messages sent as plain strings in multi-turn conversations** — when the AI called a tool and the conversation continued to a second turn, the assistant message containing the tool call was being serialized as a plain string rather than the array of `tool_use` content blocks that Anthropic's API requires. This caused Anthropic to reject Turn 2 requests with a message format error. The fix formats assistant messages that contain `toolCalls` as `content: [{ type: 'tool_use', id, name, input }]` — the exact structure Anthropic expects. Plain assistant messages with no tool calls are unaffected.

---

## [0.2.0] — 2026-06-04

### Added

- **`ai.wrap()`** — wraps any async function or external SDK chain with AILink observability in one line. The wrapped function behaves identically to the original — same arguments, same return type, same errors. Every call is tracked through the AILink platform automatically.

  Works with LangChain, Vercel AI SDK, or any existing async function. No rewrites. No restructuring. One line on top.

  Simple mode — zero configuration:
  ```typescript
  const wrapped = ai.wrap(chain.invoke.bind(chain))
  ```

  Advanced mode — full dashboard visibility:
  ```typescript
  const wrapped = ai.wrap(chain.invoke.bind(chain), {
    toolName: 'ProductRagChain',
    role: 'admin'
  })
  ```

  WrapOptions:
  - toolName — name shown on the AILink dashboard. Critical when wrapping .bind() calls because .bind() destroys the native function name. Defaults to fn.name if available, otherwise 'anonymous'
  - role — role used for tracking context only, not access control. Defaults to 'user'

- **`WrapOptions` interface** — exported from @ailink/sdk. Provides TypeScript autocompletion when passing options to ai.wrap().

### Fixed

- Open timer handle in tracker unit tests caused Jest to force-exit with a worker process warning after every test run. Fixed by replacing the 10 second setTimeout with a never-resolving promise. All 188 unit tests pass cleanly with zero warnings.

---

## Roadmap

Items planned for future releases — see `POST_LAUNCH.md` for full details.

- `@ailink/logger` — wrap any existing AI SDK client to connect to the AILink platform dashboard
- `ailink inspect` CLI — visualize registered tools, roles, and groups in the terminal
- Decorator support for automatic tool registration
- `ailink init` CLI wizard — scan a codebase and generate AILink config automatically
- Streaming response support
- System prompt support
