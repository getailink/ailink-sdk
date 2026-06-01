# AILink — Testing Guide

---

## Running the Tests

```bash
# All tests
npm test

# Unit tests only — fast, no API keys needed (~5 seconds)
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Watch mode — re-runs on file changes
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Test Structure

```
tests/
├── unit/           — Tests for individual components (registry, validator, errors, types, tracker)
├── integration/    — Tests for provider adapters and full AILink flows (mocked providers)
├── e2e/            — End-to-end scenario tests (inventory, multi-turn, role-based, error recovery)
├── fixtures/       — Shared test data, mock provider responses, tool schemas
└── setup.ts        — Global test setup
```

---

## Unit Tests

Unit tests cover individual components with no external dependencies. They run fast and require no API keys.

```bash
npm run test:unit
```

Covers: `FunctionRegistry`, `Validator`, error classes, TypeScript types, `Tracker`, and `maxIterations` configuration.

---

## Integration Tests

Integration tests verify that each provider adapter works correctly and that the full AILink flow functions as expected. These use mocked provider responses — no real API keys needed.

```bash
npm run test:integration
```

Covers: OpenAI adapter, Claude adapter, Groq adapter, Gemini adapter, fallback provider chain, retry logic, session management, and the full AILink class.

---

## End-to-End Tests

E2E tests run complete realistic scenarios from user prompt to final response using mocked providers.

```bash
npm run test:e2e
```

Covers: inventory management scenario, multi-turn conversations, role-based access control, error recovery.

---

## Testing with Real API Keys

Some tests are marked as skipped by default because they require real provider API keys. To run them:

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your real API keys to `.env`:
```
GROQ_KEY=your-real-groq-key
OPENAI_API_KEY=your-real-openai-key
CLAUDE_API_KEY=your-real-claude-key
GEMINI_KEY=your-real-gemini-key
```

You only need keys for the providers you want to test. Groq has a free tier — start there.

3. Run the examples to verify real API connectivity:
```bash
npx ts-node examples/demo.ts
npx ts-node examples/02-ai-inventory.ts
npx ts-node examples/03-advanced-ai-inventory.ts
npx ts-node examples/api-endpoint.ts
```

---

## Running Examples

The `examples/` folder contains working demos you can run directly:

```bash
npx ts-node examples/demo.ts
```
Basic tool calling. Registers 4 tools and runs 4 queries. Good first test to confirm your API key works.

```bash
npx ts-node examples/02-ai-inventory.ts
```
AI-powered inventory system. Shows tool registration, natural language queries, order placement, and stock checking across a full conversation.

```bash
npx ts-node examples/03-advanced-ai-inventory.ts
```
Advanced scenarios with session memory. Shows the AI retaining context across multiple turns, planning, and intelligent reasoning.

```bash
npx ts-node examples/api-endpoint.ts
```
Shows how to wire AILink to an Express backend with session persistence across HTTP requests.

All examples require a real API key in your `.env` file. Groq has a free tier — start there.

> If you are on Groq's free tier, the advanced example makes several API calls in sequence. If you hit a rate limit, wait 60 seconds and run again.

---

## Coverage

```bash
npm run test:coverage
```

Coverage is configured to require 90% across branches, functions, lines, and statements for the `src/` directory (excluding `src/widget/` and `src/index.ts`).

---

## Common Test Issues

**Tests fail with `Cannot find module`**
Run `npm install` to make sure all dependencies are installed.

**Provider tests timeout**
Integration tests that use mocked providers should not timeout. If they do, check your `jest.config.js` — timeout is set to 30 seconds by default.

**Skipped tests**
Some tests are skipped because they require real API keys or test browser behaviour. This is expected. The skip count does not indicate a problem.

**Build errors before tests run**
Run `npm run build` first and fix any TypeScript errors before running tests.
