/**
 * ═══════════════════════════════════════════════════════════════
 * AILink SDK — FULL AUDIT TEST SUITE
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests every feature described in the SDK spec:
 *  1.  Basic function registration
 *  2.  Registration with group option
 *  3.  Registration with roles option
 *  4.  ai.run() with groups filter — blocks tools outside the group
 *  5.  ai.run() with userRole — blocks unauthorized roles
 *  6.  ai.run() with BOTH groups AND userRole together
 *  7.  Chat widget initialization (AILinkWidget React component)
 *  8.  Chat widget sending a message and getting a response
 *  9.  Chat widget calling a registered tool
 * 10.  Multi-provider switching
 * 11.  Session creation and persistence
 * 12.  Logging output
 * 13.  What happens when unauthorized role is passed
 * 14.  What happens when unknown group is passed
 */

import { AILink } from '../../src/ailink'
import { FunctionRegistry } from '../../src/registry'
import { AILinkSession } from '../../src/session'
import { Engine, EngineResult } from '../../src/engine'
import { Validator } from '../../src/validator'
import {
  AILinkConfigError,
  ToolAlreadyExistsError,
  ToolNotFoundError,
  UnsupportedProviderError,
  EmptyGroupError,
  AllProvidersFailedError,
} from '../../src/errors'
import { ProviderAdapter } from '../../src/providers/base'
import { ProviderResponse, Message, RoleName } from '../../src/types'

// ─────────────────────────────────────────────
// Mock Provider — returns controlled responses
// without hitting any real API
// ─────────────────────────────────────────────

function createMockProvider(overrides?: Partial<ProviderAdapter>): ProviderAdapter {
  let callCount = 0
  return {
    name: 'mock',
    initialize: jest.fn(),
    execute: jest.fn(async (messages: Message[], tools: object[]): Promise<ProviderResponse> => {
      callCount++
      // On first call: request a tool call if tools are available
      if (callCount === 1 && tools.length > 0) {
        const firstTool = (tools as any[])[0]
        return {
          type: 'tool_call',
          toolName: firstTool.name,
          toolArgs: firstTool.name === 'checkInventory'
            ? { productId: 'product-001' }
            : firstTool.name === 'getWeather'
            ? { city: 'Paris' }
            : {},
          callId: 'mock-call-1',
        }
      }
      // On subsequent calls or no tools: return text
      return { type: 'text', text: 'Mock response completed.' }
    }),
    ...overrides,
  }
}

/** Build a mock provider that always returns text (no tool calls) */
function createTextOnlyProvider(text: string = 'Text-only response'): ProviderAdapter {
  return {
    name: 'mock-text',
    initialize: jest.fn(),
    execute: jest.fn(async () => ({ type: 'text' as const, text })),
  }
}

/** Build a mock provider that always throws (simulates provider failure) */
function createFailingProvider(errorMsg: string = 'Provider API error'): ProviderAdapter {
  return {
    name: 'mock-fail',
    initialize: jest.fn(),
    execute: jest.fn(async () => { throw new Error(errorMsg) }),
  }
}

// ─────────────────────────────────────────────
// Mock the provider factory so AILink uses our
// mock provider instead of hitting real APIs
// ─────────────────────────────────────────────
jest.mock('../../src/providers', () => {
  const originalModule = jest.requireActual('../../src/providers')
  let _mockProvider: ProviderAdapter | null = null
  return {
    ...originalModule,
    __setMockProvider: (p: ProviderAdapter) => { _mockProvider = p },
    __clearMockProvider: () => { _mockProvider = null },
    getProvider: (name: string) => {
      if (_mockProvider) return _mockProvider
      // Fall back to real implementation for unsupported-provider tests
      return originalModule.getProvider(name)
    },
  }
})

// Helper to set the mock provider
function setMockProvider(provider: ProviderAdapter) {
  const mod = require('../../src/providers') as any
  mod.__setMockProvider(provider)
}
function clearMockProvider() {
  const mod = require('../../src/providers') as any
  mod.__clearMockProvider()
}

// ─────────────────────────────────────────────
// Helper: create a standard AILink instance
// ─────────────────────────────────────────────
function createTestAI(overrides?: Record<string, any>): AILink {
  return new AILink({
    platformKey: 'test-ailink-key',
    provider: 'openai',
    providerKey: 'test-provider-key',
    debug: false,
    retries: 0,
    ...overrides,
  })
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════

describe('AILink SDK — Full Audit', () => {

  afterEach(() => {
    clearMockProvider()
    jest.restoreAllMocks()
  })

  // ─────────────────────────────────────────────
  // 1. BASIC FUNCTION REGISTRATION
  // ─────────────────────────────────────────────
  describe('1. Basic Function Registration', () => {
    test('registers a tool with preferred (new) signature', () => {
      const ai = createTestAI()
      ai.register('getWeather', async ({ city }) => `Sunny in ${city}`, {
        description: 'Get weather for a city',
        parameters: {
          type: 'object',
          properties: { city: { type: 'string' } },
          required: ['city'],
        },
      })
      expect(ai.tools()).toContain('getWeather')
    })

    test('registers a tool with legacy signature', () => {
      const ai = createTestAI()
      const schema = {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      }
      ai.register(
        'getWeather',
        'Get weather for a city',
        schema,
        async ({ city }) => `Sunny in ${city}`,
      )
      expect(ai.tools()).toContain('getWeather')
    })

    test('throws ToolAlreadyExistsError on duplicate registration', () => {
      const ai = createTestAI()
      const handler = async () => 'result'
      const opts = { description: 'test', parameters: {} }
      ai.register('dup', handler, opts)
      expect(() => ai.register('dup', handler, opts)).toThrow(ToolAlreadyExistsError)
    })

    test('unregister removes a tool', () => {
      const ai = createTestAI()
      ai.register('temp', async () => 'x', { description: 'temp', parameters: {} })
      expect(ai.tools()).toContain('temp')
      ai.unregister('temp')
      expect(ai.tools()).not.toContain('temp')
    })

    test('unregister throws ToolNotFoundError for unknown tool', () => {
      const ai = createTestAI()
      expect(() => ai.unregister('nonexistent')).toThrow(ToolNotFoundError)
    })

    test('tools() returns empty array when nothing registered', () => {
      const ai = createTestAI()
      expect(ai.tools()).toEqual([])
    })

    test('multiple tools can be registered independently', () => {
      const ai = createTestAI()
      ai.register('a', async () => 1, { description: 'a', parameters: {} })
      ai.register('b', async () => 2, { description: 'b', parameters: {} })
      ai.register('c', async () => 3, { description: 'c', parameters: {} })
      expect(ai.tools()).toEqual(['a', 'b', 'c'])
    })
  })

  // ─────────────────────────────────────────────
  // 2. REGISTRATION WITH GROUP OPTION
  // ─────────────────────────────────────────────
  describe('2. Registration with Group Option', () => {
    test('registers tool with a group', () => {
      const registry = new FunctionRegistry()
      registry.register('checkStock', 'Check stock', { type: 'object', properties: {} }, async () => 42, { group: 'inventory' })
      const tool = registry.get('checkStock')
      expect(tool).toBeDefined()
      expect(tool!.group).toBe('inventory')
    })

    test('registers tool with group via preferred signature on AILink', () => {
      const ai = createTestAI()
      ai.register('checkStock', async () => 42, {
        description: 'Check stock',
        parameters: { type: 'object', properties: {} },
        group: 'inventory',
      })
      expect(ai.tools()).toContain('checkStock')
    })

    test('tool without group has undefined group', () => {
      const registry = new FunctionRegistry()
      registry.register('noGroup', 'No group', {}, async () => 'x')
      const tool = registry.get('noGroup')
      expect(tool!.group).toBeUndefined()
    })

    test('getFiltered returns only tools in specified group', () => {
      const registry = new FunctionRegistry()
      registry.register('invA', 'Inventory A', {}, async () => 'a', { group: 'inventory' })
      registry.register('ordA', 'Order A', {}, async () => 'b', { group: 'orders' })
      registry.register('invB', 'Inventory B', {}, async () => 'c', { group: 'inventory' })

      const filtered = registry.getFiltered('developer', ['inventory'])
      expect(filtered.map(t => t.name)).toEqual(['invA', 'invB'])
    })

    test('getFiltered with no groups returns all tools for role', () => {
      const registry = new FunctionRegistry()
      registry.register('a', 'a', {}, async () => 1, { group: 'g1' })
      registry.register('b', 'b', {}, async () => 2)

      const all = registry.getFiltered('developer')
      expect(all.length).toBe(2)
    })
  })

  // ─────────────────────────────────────────────
  // 3. REGISTRATION WITH ROLES OPTION
  // ─────────────────────────────────────────────
  describe('3. Registration with Roles Option', () => {
    test('defaults to all roles when none specified', () => {
      const registry = new FunctionRegistry()
      registry.register('anyRole', 'Any role tool', {}, async () => 'x')
      const tool = registry.get('anyRole')
      expect(tool!.roles).toEqual(['user', 'admin', 'developer'])
    })

    test('restricts to specified roles', () => {
      const registry = new FunctionRegistry()
      registry.register('adminOnly', 'Admin tool', {}, async () => 'x', { roles: ['admin'] })
      const tool = registry.get('adminOnly')
      expect(tool!.roles).toEqual(['admin'])
    })

    test('getByRole(user) only sees tools with user role', () => {
      const registry = new FunctionRegistry()
      registry.register('userTool', 'user tool', {}, async () => 'u', { roles: ['user'] })
      registry.register('adminTool', 'admin tool', {}, async () => 'a', { roles: ['admin'] })

      const userTools = registry.getByRole('user')
      expect(userTools.map(t => t.name)).toContain('userTool')
      expect(userTools.map(t => t.name)).not.toContain('adminTool')
    })

    test('getByRole(admin) sees admin and user tools', () => {
      const registry = new FunctionRegistry()
      registry.register('userTool', 'user tool', {}, async () => 'u', { roles: ['user'] })
      registry.register('adminTool', 'admin tool', {}, async () => 'a', { roles: ['admin'] })
      registry.register('devTool', 'dev tool', {}, async () => 'd', { roles: ['developer'] })

      const adminTools = registry.getByRole('admin')
      const names = adminTools.map(t => t.name)
      expect(names).toContain('userTool')
      expect(names).toContain('adminTool')
      expect(names).not.toContain('devTool')
    })

    test('getByRole(developer) sees all tools', () => {
      const registry = new FunctionRegistry()
      registry.register('userTool', 'u', {}, async () => 'u', { roles: ['user'] })
      registry.register('adminTool', 'a', {}, async () => 'a', { roles: ['admin'] })
      registry.register('devTool', 'd', {}, async () => 'd', { roles: ['developer'] })

      const devTools = registry.getByRole('developer')
      expect(devTools.length).toBe(3)
    })
  })

  // ─────────────────────────────────────────────
  // 4. ai.run() WITH GROUPS FILTER
  // ─────────────────────────────────────────────
  describe('4. ai.run() with Groups Filter — Blocks Tools Outside Group', () => {
    test('only tools in the specified group are passed to the provider', async () => {
      const mockProvider = createTextOnlyProvider('Group-filtered result')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('invCheck', async () => 42, {
        description: 'Check inventory',
        parameters: { type: 'object', properties: {} },
        group: 'inventory',
      })
      ai.register('ordCheck', async () => 'shipped', {
        description: 'Check order',
        parameters: { type: 'object', properties: {} },
        group: 'orders',
      })

      const result = await ai.run('Check stock', { groups: ['inventory'] })
      expect(result.allowedTools).toContain('invCheck')
      expect(result.allowedTools).not.toContain('ordCheck')
    })

    test('tools without a group are excluded when groups filter is active', async () => {
      const mockProvider = createTextOnlyProvider('Filtered')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('grouped', async () => 1, {
        description: 'Grouped',
        parameters: {},
        group: 'myGroup',
      })
      ai.register('ungrouped', async () => 2, {
        description: 'Ungrouped',
        parameters: {},
      })

      const result = await ai.run('test', { groups: ['myGroup'] })
      expect(result.allowedTools).toContain('grouped')
      expect(result.allowedTools).not.toContain('ungrouped')
    })
  })

  // ─────────────────────────────────────────────
  // 5. ai.run() WITH userRole — BLOCKS UNAUTHORIZED
  // ─────────────────────────────────────────────
  describe('5. ai.run() with userRole — Blocks Unauthorized Roles', () => {
    test('user role can only see user-authorized tools', async () => {
      const mockProvider = createTextOnlyProvider('Role-filtered result')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('publicTool', async () => 'pub', {
        description: 'Public', parameters: {},
        roles: ['user', 'admin', 'developer'],
      })
      ai.register('adminTool', async () => 'admin', {
        description: 'Admin only', parameters: {},
        roles: ['admin'],
      })

      const result = await ai.run('test', { userRole: 'user' })
      expect(result.allowedTools).toContain('publicTool')
      expect(result.allowedTools).not.toContain('adminTool')
      expect(result.userRole).toBe('user')
    })

    test('admin role sees admin and user tools but not developer-only', async () => {
      const mockProvider = createTextOnlyProvider('Admin result')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('userTool', async () => 'u', {
        description: 'User', parameters: {},
        roles: ['user'],
      })
      ai.register('devTool', async () => 'd', {
        description: 'Dev only', parameters: {},
        roles: ['developer'],
      })

      const result = await ai.run('test', { userRole: 'admin' })
      expect(result.allowedTools).toContain('userTool')
      expect(result.allowedTools).not.toContain('devTool')
    })

    test('developer role sees all tools regardless of roles restriction', async () => {
      const mockProvider = createTextOnlyProvider('Dev result')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('a', async () => 1, { description: 'a', parameters: {}, roles: ['user'] })
      ai.register('b', async () => 2, { description: 'b', parameters: {}, roles: ['admin'] })
      ai.register('c', async () => 3, { description: 'c', parameters: {}, roles: ['developer'] })

      const result = await ai.run('test', { userRole: 'developer' })
      expect(result.allowedTools.length).toBe(3)
    })

    test('defaults to user role when not specified', async () => {
      const mockProvider = createTextOnlyProvider('Default role')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('pub', async () => 1, { description: 'pub', parameters: {}, roles: ['user'] })

      const result = await ai.run('test')
      expect(result.userRole).toBe('user')
    })
  })

  // ─────────────────────────────────────────────
  // 6. ai.run() WITH BOTH GROUPS AND userRole
  // ─────────────────────────────────────────────
  describe('6. ai.run() with BOTH Groups AND userRole', () => {
    test('combines group and role filtering correctly', async () => {
      const mockProvider = createTextOnlyProvider('Combined filter')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('invUser', async () => 1, {
        description: 'Inventory user tool', parameters: {},
        roles: ['user', 'admin'], group: 'inventory',
      })
      ai.register('invAdmin', async () => 2, {
        description: 'Inventory admin tool', parameters: {},
        roles: ['admin'], group: 'inventory',
      })
      ai.register('ordUser', async () => 3, {
        description: 'Order user tool', parameters: {},
        roles: ['user'], group: 'orders',
      })

      // User + inventory group → should only get invUser
      const result = await ai.run('test', { userRole: 'user', groups: ['inventory'] })
      expect(result.allowedTools).toContain('invUser')
      expect(result.allowedTools).not.toContain('invAdmin') // admin role required
      expect(result.allowedTools).not.toContain('ordUser')  // wrong group
    })

    test('admin with inventory group sees invUser + invAdmin but not ordUser', async () => {
      const mockProvider = createTextOnlyProvider('Admin inventory')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('invUser', async () => 1, {
        description: 'Inv user', parameters: {},
        roles: ['user'], group: 'inventory',
      })
      ai.register('invAdmin', async () => 2, {
        description: 'Inv admin', parameters: {},
        roles: ['admin'], group: 'inventory',
      })
      ai.register('ordUser', async () => 3, {
        description: 'Ord user', parameters: {},
        roles: ['user'], group: 'orders',
      })

      const result = await ai.run('test', { userRole: 'admin', groups: ['inventory'] })
      expect(result.allowedTools).toContain('invUser')
      expect(result.allowedTools).toContain('invAdmin')
      expect(result.allowedTools).not.toContain('ordUser')
    })
  })

  // ─────────────────────────────────────────────
  // 7. CHAT WIDGET INITIALIZATION
  // ─────────────────────────────────────────────
  describe('7. Chat Widget Initialization', () => {
    test('AILinkWidget.tsx source file exists and exports a React component', () => {
      // React is a peer dependency — may not be installed in test env.
      // We verify the source file structurally instead.
      const fs = require('fs')
      const path = require('path')
      const widgetPath = path.resolve(__dirname, '../../src/widget/AILinkWidget.tsx')
      expect(fs.existsSync(widgetPath)).toBe(true)

      const source = fs.readFileSync(widgetPath, 'utf8')
      // Exports a named function component
      expect(source).toContain('export function AILinkWidget')
      // Uses React hooks
      expect(source).toContain('useState')
      expect(source).toContain('useRef')
      expect(source).toContain('useEffect')
      // Has a default export
      expect(source).toContain('export default AILinkWidget')
    })

    test('AILinkWidget accepts endpoint, title, placeholder, theme, position props', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../src/widget/AILinkWidget.tsx'), 'utf8'
      )
      // Verify the props interface contains required fields
      expect(source).toContain('endpoint: string')
      expect(source).toContain("title?:")
      expect(source).toContain("placeholder?:")
      expect(source).toContain("theme?:")
      expect(source).toContain("position?:")
    })

    test('AILinkScript.ts source file exists and is an IIFE', () => {
      const fs = require('fs')
      const path = require('path')
      const scriptPath = path.resolve(__dirname, '../../src/widget/AILinkScript.ts')
      expect(fs.existsSync(scriptPath)).toBe(true)

      const source = fs.readFileSync(scriptPath, 'utf8')
      // IIFE pattern
      expect(source).toContain('(function ()')
      // Uses DOMContentLoaded
      expect(source).toContain('DOMContentLoaded')
      // Looks for #ailink-widget container
      expect(source).toContain("getElementById('ailink-widget')")
    })

    test('AILinkScript injects inline CSS (no external CDN dependency)', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../src/widget/AILinkScript.ts'), 'utf8'
      )
      expect(source).toContain('INLINE_CSS')
      // Verify no CDN link
      expect(source).not.toContain('https://cdn.ailink.com/widget.css')
    })
  })

  // ─────────────────────────────────────────────
  // 8. CHAT WIDGET SENDING A MESSAGE
  // ─────────────────────────────────────────────
  describe('8. Chat Widget — Send Message Flow', () => {
    test('widget uses fetch to POST message to endpoint', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../src/widget/AILinkWidget.tsx'), 'utf8'
      )
      // Verify fetch POST pattern
      expect(source).toContain('fetch(endpoint')
      expect(source).toContain("method: 'POST'")
      expect(source).toContain("'Content-Type': 'application/json'")
    })

    test('widget sends sessionId with every message for multi-turn memory', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../src/widget/AILinkWidget.tsx'), 'utf8'
      )
      // Verify sessionId is sent in the body
      expect(source).toContain('body: JSON.stringify({ message: text, sessionId })')
    })

    test('widget generates a stable sessionId via crypto.randomUUID on mount', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../src/widget/AILinkWidget.tsx'), 'utf8'
      )
      expect(source).toContain('crypto.randomUUID()')
    })
  })

  // ─────────────────────────────────────────────
  // 9. CHAT WIDGET CALLING A REGISTERED TOOL
  // ─────────────────────────────────────────────
  describe('9. Chat Widget — Tool Calling Flow', () => {
    test('widget POSTs to an endpoint — tools are called server-side, not in widget', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../src/widget/AILinkWidget.tsx'), 'utf8'
      )
      // Widget does NOT import AILink core — tool execution is server-side only
      expect(source).not.toMatch(/from ['"]\.\.\/ailink['"]/)
      expect(source).not.toMatch(/from ['"]\.\.\/engine['"]/)
      expect(source).not.toMatch(/from ['"]\.\.\/registry['"]/)
      // Widget reads { response } from the backend
      expect(source).toContain('data.response')
    })

    test('AILinkScript (HTML widget) also POSTs to endpoint, not direct AI', () => {
      const fs = require('fs')
      const path = require('path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../../src/widget/AILinkScript.ts'), 'utf8'
      )
      expect(source).toContain('fetch(endpoint')
      expect(source).toContain("method: 'POST'")
      expect(source).toContain('data.response')
    })
  })

  // ─────────────────────────────────────────────
  // 10. MULTI-PROVIDER SWITCHING
  // ─────────────────────────────────────────────
  describe('10. Multi-Provider Switching', () => {
    test('all four provider names are accepted in config', () => {
      const providers: Array<'openai' | 'claude' | 'groq' | 'gemini'> = ['openai', 'claude', 'groq', 'gemini']
      for (const p of providers) {
        setMockProvider(createTextOnlyProvider(`Hello from ${p}`))
        const ai = createTestAI({ provider: p })
        expect(ai).toBeInstanceOf(AILink)
        clearMockProvider()
      }
    })

    test('unsupported provider throws UnsupportedProviderError', () => {
      clearMockProvider() // let it hit real getProvider
      expect(() => createTestAI({ provider: 'deepseek' as any })).toThrow(UnsupportedProviderError)
    })

    test('fallback providers are configured but primary is tried first', async () => {
      const mockProvider = createTextOnlyProvider('Primary succeeded')
      setMockProvider(mockProvider)

      const ai = createTestAI({
        fallback: ['claude', 'groq'],
        retries: 0,
      })
      ai.register('t', async () => 1, { description: 't', parameters: {} })
      const result = await ai.run('test')
      expect(result.response).toBe('Primary succeeded')
      expect(result.provider).toBe('openai')
    })

    test('AllProvidersFailedError thrown when all providers fail', async () => {
      const failProvider = createFailingProvider('API down')
      setMockProvider(failProvider)

      const ai = createTestAI({ retries: 0, fallback: [] })
      ai.register('t', async () => 1, { description: 't', parameters: {} })

      await expect(ai.run('test')).rejects.toThrow(AllProvidersFailedError)
    })
  })

  // ─────────────────────────────────────────────
  // 11. SESSION CREATION AND PERSISTENCE
  // ─────────────────────────────────────────────
  describe('11. Session Creation and Persistence', () => {
    test('createSession returns AILinkSession with a sessionId', () => {
      const ai = createTestAI()
      const session = ai.createSession()
      expect(session).toBeInstanceOf(AILinkSession)
      expect(session.sessionId).toBeDefined()
      expect(typeof session.sessionId).toBe('string')
    })

    test('createSession with custom sessionId uses it', () => {
      const ai = createTestAI()
      const session = ai.createSession('my-custom-id')
      expect(session.sessionId).toBe('my-custom-id')
    })

    test('session tracks conversation history', async () => {
      const mockProvider = createTextOnlyProvider('Remembered response')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      ai.register('t', async () => 1, { description: 't', parameters: {} })
      const session = ai.createSession()

      await session.run('Hello')
      const history = session.getHistory()
      expect(history.length).toBe(2) // user + assistant
      expect(history[0].role).toBe('user')
      expect(history[0].content).toBe('Hello')
      expect(history[1].role).toBe('assistant')
    })

    test('session.turns counts user messages', async () => {
      const mockProvider = createTextOnlyProvider('Response')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      const session = ai.createSession()

      expect(session.turns).toBe(0)
      await session.run('Turn 1')
      expect(session.turns).toBe(1)
      await session.run('Turn 2')
      expect(session.turns).toBe(2)
    })

    test('session.clearHistory resets history but keeps sessionId', async () => {
      const mockProvider = createTextOnlyProvider('Response')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      const session = ai.createSession('keep-id')
      await session.run('Hello')
      expect(session.getHistory().length).toBe(2)

      session.clearHistory()
      expect(session.getHistory().length).toBe(0)
      expect(session.sessionId).toBe('keep-id')
    })

    test('session respects maxTurns and prunes oldest messages', async () => {
      const mockProvider = createTextOnlyProvider('Response')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      const session = ai.createSession(undefined, 2) // max 2 turns = 4 messages

      await session.run('Turn 1')
      await session.run('Turn 2')
      await session.run('Turn 3') // should prune Turn 1

      const history = session.getHistory()
      // After 3 turns with maxTurns=2, only last 2 turns should remain (4 messages)
      expect(history.length).toBe(4)
      expect(history[0].content).toBe('Turn 2')
    })

    test('session restore with initialHistory works', () => {
      const ai = createTestAI()
      const savedHistory: Message[] = [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ]
      const session = ai.createSession('restored-id', 50, savedHistory)
      expect(session.getHistory().length).toBe(2)
      expect(session.getHistory()[0].content).toBe('Previous question')
    })

    test('session passes conversationHistory to engine via run()', async () => {
      const mockProvider = createTextOnlyProvider('With history')
      setMockProvider(mockProvider)

      const ai = createTestAI()
      const session = ai.createSession()

      await session.run('First message')
      await session.run('Second message')

      // The provider should receive accumulated history on the second call
      const executeCalls = (mockProvider.execute as jest.Mock).mock.calls
      // Second session.run() call → second engine.run() → provider.execute should receive history
      // First call: messages = [user: "First message"]
      // Second call: messages = [user: "First message", assistant: "With history", user: "Second message"]
      expect(executeCalls.length).toBeGreaterThanOrEqual(2)
      const secondCallMessages = executeCalls[1][0] as Message[]
      expect(secondCallMessages.length).toBeGreaterThan(1)
    })
  })

  // ─────────────────────────────────────────────
  // 12. LOGGING OUTPUT
  // ─────────────────────────────────────────────
  describe('12. Logging Output', () => {
    test('debug=true logs initialization message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setMockProvider(createTextOnlyProvider())
      createTestAI({ debug: true })
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[AILink] Initialized'))
      consoleSpy.mockRestore()
    })

    test('debug=true logs tool registration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setMockProvider(createTextOnlyProvider())
      const ai = createTestAI({ debug: true })
      ai.register('loggedTool', async () => 1, { description: 't', parameters: {} })
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Tool registered: loggedTool'))
      consoleSpy.mockRestore()
    })

    test('debug=false produces no console.log output', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      setMockProvider(createTextOnlyProvider())
      const ai = createTestAI({ debug: false })
      ai.register('silentTool', async () => 1, { description: 't', parameters: {} })
      // Filter for AILink-specific logs only
      const ailinkLogs = consoleSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('[AILink]')
      )
      expect(ailinkLogs.length).toBe(0)
      consoleSpy.mockRestore()
    })

    test('tracker.track fires fetch to platform URL', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
      setMockProvider(createTextOnlyProvider('tracked'))

      const ai = createTestAI({ platformUrl: 'https://test.ailink.com/v1' })
      ai.register('t', async () => 1, { description: 't', parameters: {} })
      await ai.run('test')

      // Tracker sends a fire-and-forget fetch
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://test.ailink.com/v1/logs',
        expect.objectContaining({ method: 'POST' })
      )
      fetchSpy.mockRestore()
    })
  })

  // ─────────────────────────────────────────────
  // 13. UNAUTHORIZED ROLE BEHAVIOR
  // ─────────────────────────────────────────────
  describe('13. Unauthorized Role Behavior', () => {
    test('user cannot see admin-only tools in allowedTools', async () => {
      setMockProvider(createTextOnlyProvider('No admin tools'))
      const ai = createTestAI()
      ai.register('adminDelete', async () => 'deleted', {
        description: 'Delete user', parameters: {},
        roles: ['admin'],
      })
      ai.register('publicView', async () => 'viewed', {
        description: 'View', parameters: {},
        roles: ['user'],
      })

      const result = await ai.run('Delete a user', { userRole: 'user' })
      expect(result.allowedTools).not.toContain('adminDelete')
      expect(result.allowedTools).toContain('publicView')
    })

    test('if AI tries to call a tool not in allowedTools, engine blocks it', async () => {
      // Create a provider that tries to call a tool the user shouldn't have access to
      let callIdx = 0
      const trickProvider: ProviderAdapter = {
        name: 'trick',
        initialize: jest.fn(),
        execute: jest.fn(async (messages: Message[], tools: object[]) => {
          callIdx++
          if (callIdx === 1) {
            // Provider tries to call 'adminDelete' even though user role shouldn't see it
            return {
              type: 'tool_call' as const,
              toolName: 'adminDelete',
              toolArgs: {},
              callId: 'trick-1',
            }
          }
          return { type: 'text' as const, text: 'Blocked attempt handled.' }
        }),
      }
      setMockProvider(trickProvider)

      const ai = createTestAI()
      ai.register('adminDelete', async () => 'DELETED', {
        description: 'Delete', parameters: {},
        roles: ['admin'],
      })
      ai.register('publicView', async () => 'viewed', {
        description: 'View', parameters: {},
        roles: ['user'],
      })

      const result = await ai.run('Delete user', { userRole: 'user' })
      // adminDelete should NOT appear in toolsCalled because the engine blocks it
      expect(result.toolsCalled).not.toContain('adminDelete')
    })
  })

  // ─────────────────────────────────────────────
  // 14. UNKNOWN GROUP BEHAVIOR
  // ─────────────────────────────────────────────
  describe('14. Unknown Group Behavior', () => {
    test('Engine throws EmptyGroupError directly when group has no matching tools', async () => {
      // Test at Engine level — EmptyGroupError is thrown directly
      const registry = new FunctionRegistry()
      registry.register('tool1', 'Tool 1', {}, async () => 1, { group: 'inventory' })

      const provider = createTextOnlyProvider()
      const engine = new Engine(registry, provider, new Validator())

      await expect(
        engine.run('test', { groups: ['nonexistent-group'] })
      ).rejects.toThrow(EmptyGroupError)
    })

    test('EmptyGroupError message includes the group names', async () => {
      const registry = new FunctionRegistry()
      registry.register('tool1', 'Tool 1', {}, async () => 1, { group: 'inventory' })

      const provider = createTextOnlyProvider()
      const engine = new Engine(registry, provider, new Validator())

      try {
        await engine.run('test', { groups: ['unknown1', 'unknown2'] })
        fail('Expected EmptyGroupError')
      } catch (err: any) {
        expect(err).toBeInstanceOf(EmptyGroupError)
        expect(err.message).toContain('unknown1')
        expect(err.message).toContain('unknown2')
      }
    })

    test('AILink.run() throws EmptyGroupError immediately when groups have no matching tools (FIXED)', async () => {
      // FIXED: Early validation before provider loop now throws EmptyGroupError immediately.
      // This prevents the error from being caught and wrapped by AllProvidersFailedError.
      // Users now get clear, specific error information.
      setMockProvider(createTextOnlyProvider())
      const ai = createTestAI()
      ai.register('tool1', async () => 1, {
        description: 't1', parameters: {},
        group: 'inventory',
      })

      await expect(
        ai.run('test', { groups: ['nonexistent-group'] })
      ).rejects.toThrow(EmptyGroupError)
    })

    test('empty groups array (no groups specified) returns all tools for role', async () => {
      setMockProvider(createTextOnlyProvider('All tools'))
      const ai = createTestAI()
      ai.register('a', async () => 1, { description: 'a', parameters: {}, group: 'g1' })
      ai.register('b', async () => 2, { description: 'b', parameters: {} })

      const result = await ai.run('test', { groups: [] })
      expect(result.allowedTools.length).toBe(2)
    })
  })

  // ─────────────────────────────────────────────
  // ADDITIONAL: Engine Direct Tests
  // ─────────────────────────────────────────────
  describe('Additional: Engine — Tool Execution', () => {
    test('engine executes a tool and returns result', async () => {
      const registry = new FunctionRegistry()
      registry.register('add', 'Add two numbers', {
        type: 'object',
        properties: { a: { type: 'number' }, b: { type: 'number' } },
        required: ['a', 'b'],
      }, async ({ a, b }) => ({ sum: a + b }))

      let callCount = 0
      const provider: ProviderAdapter = {
        name: 'test',
        initialize: jest.fn(),
        execute: jest.fn(async () => {
          callCount++
          if (callCount === 1) {
            return { type: 'tool_call' as const, toolName: 'add', toolArgs: { a: 2, b: 3 }, callId: 'c1' }
          }
          return { type: 'text' as const, text: 'The sum is 5.' }
        }),
      }

      const engine = new Engine(registry, provider, new Validator())
      const result = await engine.run('What is 2+3?')
      expect(result.toolsCalled).toContain('add')
      expect(result.response).toBe('The sum is 5.')
    })

    test('engine handles max iterations gracefully', async () => {
      const registry = new FunctionRegistry()
      registry.register('loop', 'Loop tool', {}, async () => 'looping')

      // Provider always requests tool call — engine should cap at MAX_ITERATIONS
      const provider: ProviderAdapter = {
        name: 'test',
        initialize: jest.fn(),
        execute: jest.fn(async () => ({
          type: 'tool_call' as const,
          toolName: 'loop',
          toolArgs: {},
          callId: 'loop-1',
        })),
      }

      const engine = new Engine(registry, provider, new Validator())
      const result = await engine.run('Loop forever')
      expect(result.response).toContain('Unable to complete')
    })

    test('maxIterations: 3 — engine stops after exactly 3 iterations, not more', async () => {
      // Mock provider that always returns a tool call — never resolves on its own
      const alwaysToolCallProvider: ProviderAdapter = {
        name: 'mock-always-tool',
        initialize: jest.fn(),
        execute: jest.fn(async () => ({
          type: 'tool_call' as const,
          toolName: 'ticker',
          toolArgs: {},
          callId: 'tick-1',
        })),
      }
      setMockProvider(alwaysToolCallProvider)

      const ai = createTestAI({ maxIterations: 3 })
      ai.register('ticker', async () => 'tick', { description: 'Tick tool', parameters: {} })

      const result = await ai.run('Run forever')

      // Engine must have called the provider exactly 3 times before giving up
      expect((alwaysToolCallProvider.execute as jest.Mock).mock.calls.length).toBe(3)
      // And the run must have exhausted its iterations — not completed normally
      expect(result.response).toContain('Unable to complete')
    })

    test('maxIterations defaults to 10 when not specified in config', async () => {
      // Mock provider that always returns a tool call — forces the engine to loop to its limit
      const alwaysToolCallProvider: ProviderAdapter = {
        name: 'mock-always-tool-default',
        initialize: jest.fn(),
        execute: jest.fn(async () => ({
          type: 'tool_call' as const,
          toolName: 'counter',
          toolArgs: {},
          callId: 'count-1',
        })),
      }
      setMockProvider(alwaysToolCallProvider)

      // No maxIterations provided — should fall back to the default of 10
      const ai = createTestAI()
      ai.register('counter', async () => 'counted', { description: 'Counter tool', parameters: {} })

      const result = await ai.run('Count forever')

      // Default cap is 10 — provider must be called exactly 10 times
      expect((alwaysToolCallProvider.execute as jest.Mock).mock.calls.length).toBe(10)
      expect(result.response).toContain('Unable to complete')
    })
  })

  // ─────────────────────────────────────────────
  // ADDITIONAL: Validator Tests
  // ─────────────────────────────────────────────
  describe('Additional: Validator', () => {
    test('validates correct args as valid', () => {
      const v = new Validator()
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      }
      const result = v.validate({ name: 'test' }, schema)
      expect(result.valid).toBe(true)
    })

    test('validates missing required field as invalid', () => {
      const v = new Validator()
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      }
      const result = v.validate({}, schema)
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    test('validates empty schema as valid (skip validation)', () => {
      const v = new Validator()
      const result = v.validate({ anything: true }, {})
      expect(result.valid).toBe(true)
    })
  })

  // ─────────────────────────────────────────────
  // ADDITIONAL: Error Classes
  // ─────────────────────────────────────────────
  describe('Additional: Error Classes', () => {
    test('AILinkConfigError includes message prefix', () => {
      const err = new AILinkConfigError('missing key')
      expect(err.message).toContain('[AILink Config]')
      expect(err.name).toBe('AILinkConfigError')
    })

    test('ToolAlreadyExistsError includes tool name', () => {
      const err = new ToolAlreadyExistsError('myTool')
      expect(err.message).toContain('myTool')
      expect(err.name).toBe('ToolAlreadyExistsError')
    })

    test('ToolNotFoundError includes available tools', () => {
      const err = new ToolNotFoundError('missing', ['a', 'b'])
      expect(err.message).toContain('a, b')
    })

    test('UnsupportedProviderError includes provider name', () => {
      const err = new UnsupportedProviderError('deepseek')
      expect(err.message).toContain('deepseek')
    })

    test('EmptyGroupError includes group names', () => {
      const err = new EmptyGroupError(['g1', 'g2'])
      expect(err.message).toContain('g1, g2')
    })

    test('AllProvidersFailedError lists attempted providers', () => {
      const err = new AllProvidersFailedError(['openai', 'claude'])
      expect(err.message).toContain('openai, claude')
    })
  })

  // ─────────────────────────────────────────────
  // ADDITIONAL: Config Validation
  // ─────────────────────────────────────────────
  describe('Additional: Config Validation', () => {
    test('platformKey is optional — does not throw when missing', () => {
      expect(() => new AILink({ provider: 'openai', providerKey: 'k' })).not.toThrow()
    })

    test('throws on missing provider', () => {
      expect(() => new AILink({ platformKey: 'k', provider: '' as any, providerKey: 'k' })).toThrow(AILinkConfigError)
    })

    test('throws on missing providerKey', () => {
      expect(() => new AILink({ platformKey: 'k', provider: 'openai', providerKey: '' })).toThrow(AILinkConfigError)
    })

    test('throws on empty prompt in run()', async () => {
      setMockProvider(createTextOnlyProvider())
      const ai = createTestAI()
      await expect(ai.run('')).rejects.toThrow(AILinkConfigError)
      await expect(ai.run('   ')).rejects.toThrow(AILinkConfigError)
    })
  })

  // ─────────────────────────────────────────────
  // ADDITIONAL: Schema Export
  // ─────────────────────────────────────────────
  describe('Additional: Registry Schema Export', () => {
    test('exportSchema produces correct format for providers', () => {
      const registry = new FunctionRegistry()
      registry.register('test', 'Test tool', {
        type: 'object',
        properties: { x: { type: 'number' } },
      }, async () => 1)

      const schemas = registry.exportSchema()
      expect(schemas).toEqual([
        {
          name: 'test',
          description: 'Test tool',
          parameters: { type: 'object', properties: { x: { type: 'number' } } },
        },
      ])
    })

    test('exportSchema with filtered tools only exports those tools', () => {
      const registry = new FunctionRegistry()
      registry.register('a', 'A', {}, async () => 1, { roles: ['user'] })
      registry.register('b', 'B', {}, async () => 2, { roles: ['admin'] })

      const userTools = registry.getByRole('user')
      const schemas = registry.exportSchema(userTools)
      expect(schemas.length).toBe(1)
      expect((schemas[0] as any).name).toBe('a')
    })
  })
})
