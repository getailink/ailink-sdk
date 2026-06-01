// ─────────────────────────────────────────────
// AILink — Main Class
// This is what developers import and use.
// ─────────────────────────────────────────────

import { AILinkConfig, AILinkResult, RunOptions, RegisterOptions, ToolOptions, ProviderName, Message } from './types'
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
        const key =
          this.config.providerKeys?.[providerName as ProviderName] ??
          this.config.providerKey
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

  /** Remove a registered tool */
  unregister(name: string): void {
    this.registry.unregister(name)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
