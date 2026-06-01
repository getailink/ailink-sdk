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

## Roadmap

Items planned for future releases — see `POST_LAUNCH.md` for full details.

- `@ailink/logger` — wrap any existing AI SDK client to connect to the AILink platform dashboard
- `ailink inspect` CLI — visualize registered tools, roles, and groups in the terminal
- `ailink.wrap()` — wrap any async function from any SDK without changing existing code
- Decorator support for automatic tool registration
- `ailink init` CLI wizard — scan a codebase and generate AILink config automatically
- Streaming response support
- System prompt support
