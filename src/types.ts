// ─────────────────────────────────────────────
// AILink — Core Type Definitions
// ─────────────────────────────────────────────

export type ProviderName = 'gemini' | 'openai' | 'claude' | 'groq'

// Role hierarchy: developer > admin > user
export type RoleName = 'user' | 'admin' | 'developer'

export interface AILinkConfig {
  platformKey?: string
  provider: ProviderName
  providerKey: string
  /**
   * Per-provider API keys used when a fallback provider is invoked.
   * If omitted for a fallback provider, providerKey is used (which will
   * likely fail if the keys differ across providers).
   *
   * Example: { claude: 'sk-ant-...', groq: 'gsk_...' }
   */
  providerKeys?: Partial<Record<ProviderName, string>>
  model?: string
  debug?: boolean
  environment?: 'development' | 'staging' | 'production'
  fallback?: ProviderName[]
  retries?: number
  retryDelay?: number
  maxIterations?: number
  platformUrl?: string
}

export interface AILinkTool {
  name: string
  description: string
  schema: Record<string, any>
  execute: (args: any) => Promise<any>
  roles: RoleName[]
  group?: string
  compiledValidator?: (args: any) => boolean // Pre-compiled Ajv validator — set at registration
}

export interface RegisterOptions {
  roles?: RoleName[]
  group?: string
}

/**
 * Options object for the preferred register() signature.
 * Used when calling ai.register(name, execute, options).
 * This is the form shown in the README.
 */
export interface ToolOptions {
  /** What this tool does — the AI reads this to decide when to call it. */
  description: string
  /** JSON Schema describing input parameters. */
  parameters: Record<string, any>
  /** Roles allowed to invoke this tool. Defaults to all roles. */
  roles?: RoleName[]
  /** Logical group for filtering tools at runtime. */
  group?: string
}

export interface RunOptions {
  userRole?: RoleName
  sessionId?: string
  groups?: string[]
  /**
   * Prior conversation turns to prepend to the engine's history.
   * Set automatically by AILinkSession — do not set manually unless
   * you are managing your own session state.
   */
  conversationHistory?: Message[]
}

export interface ToolCallRef {
  toolName: string
  toolArgs: Record<string, any>
  callId?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  toolArgs?: Record<string, any>
  toolResult?: any
  callId?: string
  toolCalls?: ToolCallRef[]
}

export interface AILinkResult {
  response: string
  toolsCalled: string[]
  allowedTools: string[]
  executionTime: number
  provider: ProviderName
  userRole: RoleName
  groups: string[] | null
}

export interface WrapOptions {
  /**
   * Name shown in the AILink dashboard for this wrapped function.
   * Required when wrapping .bind() calls because .bind() destroys
   * the native function .name property, making dashboard logs unreadable.
   * Example: 'ProductRagChain', 'SupportChain'
   * Defaults to fn.name if available, otherwise 'anonymous'
   */
  toolName?: string

  /**
   * Role used for usage tracking only — not for access control.
   * wrap() is an observability wrapper, not a gatekeeper.
   * Pass this so your dashboard shows the correct role context
   * for each wrapped function call.
   * Defaults to 'user'
   */
  role?: RoleName
}

export interface UsageLog {
  platformKey?: string
  prompt: string
  toolsCalled: string[]
  allowedTools: string[]
  provider: ProviderName
  executionTime: number
  success: boolean
  error?: string
  timestamp: string
  sessionId?: string
  userRole: RoleName
  groups: string[] | null
}

export interface ToolCall {
  toolName: string
  toolArgs: Record<string, any>
  callId?: string
}

export interface ProviderResponse {
  type: 'text' | 'tool_call' | 'tool_calls'
  text?: string
  toolName?: string
  toolArgs?: Record<string, any>
  callId?: string
  toolCalls?: ToolCall[]
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}
