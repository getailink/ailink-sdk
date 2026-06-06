// ─────────────────────────────────────────────
// AILink — Main Class
// This is what developers import and use.
// ─────────────────────────────────────────────

import { AILinkConfig, AILinkResult, RunOptions, RegisterOptions, ToolOptions, ProviderName, Message, WrapOptions, AILinkTool } from './types'
import { AILinkConfigError, AllProvidersFailedError, EmptyGroupError } from './errors'
import { FunctionRegistry } from './registry'
import { Engine } from './engine'
import { Tracker } from './tracker'
import { Validator } from './validator'
import { AILinkSession } from './session'
import { getProvider, ProviderAdapter } from './providers'

export class AILink {
  private registry: FunctionRegistry
  private engine: Engine
  private primaryProvider: ProviderAdapter  // stored separately — never overwritten by fallback
  private tracker: Tracker
  private config: AILinkConfig

  constructor(config: AILinkConfig) {
    // platformKey is optional
    if (!config.provider) throw new AILinkConfigError('provider is required')
    if (!config.providerKey) throw new AILinkConfigError('providerKey is required')

    this.config = config
    this.registry = new FunctionRegistry()

    this.primaryProvider = getProvider(config.provider)
    this.primaryProvider.initialize(config.providerKey, config.model)

    const validator = new Validator()
    this.engine = new Engine(this.registry, this.primaryProvider, validator, config.debug, config)

    this.tracker = new Tracker(
      config.platformKey,
      config.platformUrl ?? 'https://logs.ailink.com/v1'
    )

    if (config.debug) {
      console.log(`[AILink] Initialized. Provider: ${config.provider} | Environment: ${config.environment ?? 'development'}`)
    }
  }

  /**
   * Register a function as an AI-callable tool.
   *
   * Preferred signature (matches README):
   *   ai.register(name, execute, { description, parameters, roles?, group? })
   *
   * Legacy signature (still supported, keeps existing code working):
   *   ai.register(name, description, schema, execute, options?)
   */
  register(name: string, execute: (args: any) => Promise<any>, options: ToolOptions): void
  register(name: string, description: string, schema: object, execute: (args: any) => Promise<any>, options?: RegisterOptions): void
  register(
    name: string,
    executeOrDescription: ((args: any) => Promise<any>) | string,
    optionsOrSchema: ToolOptions | object,
    execute?: (args: any) => Promise<any>,
    legacyOptions?: RegisterOptions
  ): void {
    if (typeof executeOrDescription === 'function') {
      // Preferred form: register(name, execute, { description, parameters, roles?, group? })
      const { description, parameters, roles, group } = optionsOrSchema as ToolOptions
      this.registry.register(name, description, parameters, executeOrDescription, { roles, group })
    } else {
      // Legacy form: register(name, description, schema, execute, options?)
      this.registry.register(name, executeOrDescription, optionsOrSchema as object, execute!, legacyOptions)
    }
    if (this.config.debug) console.log(`[AILink] Tool registered: ${name}`)
  }

  /**
   * Run a natural language prompt through AI.
   * AI decides which tools to call, executes them, returns final response.
   * Supports fallback providers and automatic retries.
   *
   * @param prompt  - Natural language instruction
   * @param options - userRole, sessionId, groups
   */
  async run(prompt: string, options?: RunOptions): Promise<AILinkResult> {
    if (!prompt || prompt.trim().length === 0) {
      throw new AILinkConfigError('prompt is required')
    }

    const startTime = Date.now()
    const attempted: string[] = []
    let lastError: Error | null = null

    // Build provider chain: primary + fallbacks
    const providers = [this.config.provider, ...(this.config.fallback ?? [])]
    const maxRetries = this.config.retries ?? 3
    const retryDelay = this.config.retryDelay ?? 1000

    // ── Early validation: check groups before entering provider loop ──
    // If groups are specified but no tools match, throw immediately.
    // This prevents EmptyGroupError from being wrapped by AllProvidersFailedError.
    const role = options?.userRole ?? 'user'
    const groups = options?.groups

    if (groups && groups.length > 0) {
      const filteredTools = this.registry.getFiltered(role, groups)
      if (filteredTools.length === 0) {
        throw new EmptyGroupError(groups)
      }
    }

    for (const providerName of providers) {
      attempted.push(providerName)

      // Resolve engine for this provider.
      // Primary uses the pre-built this.engine — never overwrite it.
      // Fallbacks get a fresh local engine with the correct API key for
      // that provider (from providerKeys map, or providerKey as fallback).
      let currentEngine: Engine
      if (providerName === this.config.provider) {
        currentEngine = this.engine
      } else {
        // Guard against prototype pollution — providerName originates from
        // user-supplied config and TypeScript's ProviderName constraint is
        // compile-time only. A plain JS caller could pass '__proto__' or
        // 'constructor' as a fallback name and reach the object prototype
        // through a bracket accessor. We use an explicit switch with dot
        // notation for each known provider — no bracket access, no variable
        // as a key, no way for unrecognized names to touch the prototype.
        const lookupProviderKey = (name: string): string | undefined => {
          switch (name) {
            case 'openai': return this.config.providerKeys?.openai
            case 'claude': return this.config.providerKeys?.claude
            case 'groq': return this.config.providerKeys?.groq
            case 'gemini': return this.config.providerKeys?.gemini
            default: return undefined
          }
        }
        const key = lookupProviderKey(providerName) ?? this.config.providerKey
        const fallbackProvider = getProvider(providerName as ProviderName)
        fallbackProvider.initialize(key, this.config.model)
        currentEngine = new Engine(this.registry, fallbackProvider, new Validator(), this.config.debug)
      }

      // Retry loop for this provider
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await currentEngine.run(prompt, options)

          // Success — track and return
          this.tracker.track({
            platformKey: this.config.platformKey,
            prompt,
            toolsCalled: result.toolsCalled,
            allowedTools: result.allowedTools,
            provider: providerName as ProviderName,
            executionTime: result.executionTime,
            success: true,
            timestamp: new Date().toISOString(),
            sessionId: options?.sessionId,
            userRole: result.userRole,
            groups: result.groups
          })

          return { ...result, provider: providerName as ProviderName }

        } catch (err: any) {
          lastError = err
          if (this.config.debug) {
            console.warn(`[AILink] ${providerName} attempt ${attempt + 1}/${maxRetries + 1} failed: ${err?.message}`)
          }
          if (attempt < maxRetries) {
            await sleep(retryDelay * (attempt + 1))
          }
        }
      }
    }

    // All providers exhausted — track failure and throw
    this.tracker.track({
      platformKey: this.config.platformKey,
      prompt,
      toolsCalled: [],
      allowedTools: [],
      provider: this.config.provider,
      executionTime: Date.now() - startTime,
      success: false,
      error: lastError?.message,
      timestamp: new Date().toISOString(),
      sessionId: options?.sessionId,
      userRole: options?.userRole ?? 'user',
      groups: options?.groups ?? null
    })

    throw new AllProvidersFailedError(attempted)
  }

  /**
   * Create a session for multi-turn conversations.
   * All turns share the same sessionId and conversation history.
   * Use session.run() instead of ai.run() to maintain context.
   *
   * @param sessionId      - Optional custom session ID
   * @param maxTurns       - Max user turns to retain in memory (default 50). Prevents context overflow.
   * @param initialHistory - Restore a saved session by passing history from a previous session.getHistory() call.
   */
  createSession(sessionId?: string, maxTurns?: number, initialHistory?: Message[]): AILinkSession {
    return new AILinkSession(
      (prompt, opts) => this.run(prompt, opts),
      sessionId,
      maxTurns,
      initialHistory  // Fix 1: pass history to constructor for session restore
    )
  }

  /** List all registered tool names */
  tools(): string[] {
    return this.registry.list()
  }

  /** Return full definitions for all registered tools */
  toolDefinitions(): AILinkTool[] {
    return this.registry.getAll()
  }

  /** Remove a registered tool */
  unregister(name: string): void {
    this.registry.unregister(name)
  }

  /**
   * Wrap any async function with AILink observability.
   * The returned function behaves identically to the original —
   * same arguments, same return type, same errors.
   * Every call is tracked through the AILink platform automatically.
   *
   * Use this for LangChain chains, Vercel AI functions, or any
   * existing async function you want dashboard visibility on
   * without modifying the original code.
   *
   * @param fn      - Any async function to wrap
   * @param options - Optional metadata for dashboard visibility
   *
   * @example
   * // Simple — works but logs as 'anonymous' if fn.name is empty
   * const wrapped = ai.wrap(chain.invoke.bind(chain))
   *
   * @example
   * // Full dashboard visibility
   * const wrapped = ai.wrap(chain.invoke.bind(chain), {
   *   toolName: 'ProductRagChain',
   *   role: 'admin'
   * })
   */
  wrap<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    options?: WrapOptions
  ): (...args: TArgs) => Promise<TReturn> {
    // Resolve display name — .bind() destroys fn.name so we fall back to 'anonymous'
    const resolvedName = options?.toolName ?? (fn.name || 'anonymous')
    // Resolve role — defaults to 'user' for tracking purposes only
    const resolvedRole = options?.role ?? 'user'

    // Return a wrapper with the identical signature as the original function
    return async (...args: TArgs): Promise<TReturn> => {
      const startTime = Date.now()
      try {
        // Call the original function — no modification, no interception of args
        const result = await fn(...args)

        // Track successful execution
        this.tracker.track({
          platformKey: this.config.platformKey,
          prompt: resolvedName,
          toolsCalled: [resolvedName],
          allowedTools: [resolvedName],
          provider: this.config.provider,
          executionTime: Date.now() - startTime,
          success: true,
          timestamp: new Date().toISOString(),
          userRole: resolvedRole,
          groups: null
        })

        return result
      } catch (err: any) {
        // Track failure — then re-throw so the caller still receives the error
        this.tracker.track({
          platformKey: this.config.platformKey,
          prompt: resolvedName,
          toolsCalled: [resolvedName],
          allowedTools: [resolvedName],
          provider: this.config.provider,
          executionTime: Date.now() - startTime,
          success: false,
          error: err?.message ?? 'Unknown error',
          timestamp: new Date().toISOString(),
          userRole: resolvedRole,
          groups: null
        })

        throw err
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
