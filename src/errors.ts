// ─────────────────────────────────────────────
// AILink — Custom Error Classes
// ─────────────────────────────────────────────

export class AILinkConfigError extends Error {
  constructor(message: string) {
    super(`[AILink Config] ${message}`)
    this.name = 'AILinkConfigError'
  }
}

export class ToolAlreadyExistsError extends Error {
  constructor(toolName: string) {
    super(`[AILink Registry] Tool "${toolName}" is already registered.`)
    this.name = 'ToolAlreadyExistsError'
  }
}

export class ToolNotFoundError extends Error {
  constructor(toolName: string, available?: string[]) {
    super(
      `[AILink Registry] Tool "${toolName}" not found. ` +
      `Available: ${available && available.length > 0 ? available.join(', ') : 'none'}`
    )
    this.name = 'ToolNotFoundError'
  }
}

export class UnsupportedProviderError extends Error {
  constructor(providerName: string) {
    super(`[AILink Provider] "${providerName}" is not supported. Use: gemini, openai, claude, groq`)
    this.name = 'UnsupportedProviderError'
  }
}

export class ValidationError extends Error {
  public readonly validationErrors: string[]
  constructor(toolName: string, errors: string[]) {
    super(`[AILink Validation] "${toolName}" args failed: ${errors.join(', ')}`)
    this.name = 'ValidationError'
    this.validationErrors = errors
  }
}

export class ToolExecutionError extends Error {
  constructor(toolName: string, originalError: string) {
    super(`[AILink Execution] "${toolName}" threw: ${originalError}`)
    this.name = 'ToolExecutionError'
  }
}

// Thrown when run() is called with groups that have no registered tools
export class EmptyGroupError extends Error {
  constructor(groups: string[]) {
    super(`[AILink] No tools found for groups: ${groups.join(', ')}`)
    this.name = 'EmptyGroupError'
  }
}

// Thrown when all providers fail — primary + all fallbacks exhausted
export class AllProvidersFailedError extends Error {
  constructor(attempted: string[]) {
    super(`[AILink] All providers failed: ${attempted.join(', ')}`)
    this.name = 'AllProvidersFailedError'
  }
}
