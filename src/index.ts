// ─────────────────────────────────────────────
// AILink — Main Exports
// ─────────────────────────────────────────────

export { AILink } from './ailink'
export { FunctionRegistry } from './registry'
export { AILinkSession } from './session'

export type {
  AILinkConfig,
  AILinkResult,
  AILinkTool,
  ProviderName,
  RoleName,
  RegisterOptions,
  ToolOptions,
  RunOptions,
  Message,
  UsageLog,
  ValidationResult,
  ProviderResponse,
  ToolCall,
  ToolCallRef,   // Fix 6: was missing — used in Message type; must be public
} from './types'

export {
  AILinkConfigError,
  ToolAlreadyExistsError,
  ToolNotFoundError,
  UnsupportedProviderError,
  ValidationError,
  ToolExecutionError,
  EmptyGroupError,
  AllProvidersFailedError,
} from './errors'
