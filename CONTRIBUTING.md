# Contributing

## Bug Reports

Open an issue with the following information:

### Environment

```
Node: [version from `node --version`]
NPM: [version from `npm --version`]
Provider: [openai|claude|groq|gemini]
OS: [linux|darwin|windows]
```

### Minimal Reproducible Example

Provide a standalone TypeScript snippet that reproduces the issue. Code must be runnable without external dependencies beyond @ailink/sdk.

```typescript
import { AILink } from '@ailink/sdk'

const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!
})

ai.register('exampleTool', async ({ param }) => {
  // minimal reproduction
}, {
  description: 'Example',
  parameters: { type: 'object', properties: { param: { type: 'string' } }, required: ['param'] }
})

const result = await ai.run('query')
```

### Console Output

Paste full error logs, stack traces, and console output. Enable `debug: true` in AILinkConfig:

```typescript
const ai = new AILink({
  provider: 'groq',
  providerKey: process.env.GROQ_KEY!,
  debug: true  // enables verbose logging
})
```

Include the complete output:

```
[DEBUG] Engine: Starting tool-call loop with 3 tools
[ERROR] ValidationError: Invalid arguments for checkStock
```

## Feature Requests

Describe the use case and expected behavior. Include a code example if applicable.

## Pull Requests

- Work from `main`
- Ensure `npm run build` and `npm test` pass
- Include tests for new functionality
- Update README.md if behavior changes
- Commit messages: `feat: `, `fix: `, `docs: `, `test: ` prefixes

## Code Standards

- TypeScript strict mode enforced
- Target: ES2020
- Format: 2-space indentation
- No `any` types except where unavoidable with explicit `// @ts-ignore` comment
