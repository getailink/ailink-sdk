// ─────────────────────────────────────────────
// AILink — Session Class
// Maintains conversation memory across multiple ai.run() calls.
// Use session.run() instead of ai.run() to keep context.
// ─────────────────────────────────────────────

import { Message, RoleName, RunOptions } from './types'

export class AILinkSession {
  private history: Message[] = []
  public readonly sessionId: string
  private maxTurns: number

  constructor(
    private runFn: (
      prompt: string,
      options?: RunOptions
    ) => Promise<any>,
    sessionId?: string,
    maxTurns: number = 50, // Default: prune after 50 user turns to prevent context overflow
    initialHistory?: Message[]  // Fix 1: restore saved session history
  ) {
    this.sessionId = sessionId ?? crypto.randomUUID()
    this.maxTurns = maxTurns
    // Seed history if restoring a previously saved session
    if (initialHistory && initialHistory.length > 0) {
      this.history = [...initialHistory]
    }
  }

  /**
   * Run a prompt with full conversation history.
   * AI remembers everything from previous turns in this session.
   * When history exceeds maxTurns, oldest messages are automatically pruned.
   */
  async run(prompt: string, options?: {
    userRole?: RoleName
    groups?: string[]
  }) {
    const result = await this.runFn(prompt, {
      ...options,
      sessionId: this.sessionId,
      // Pass accumulated history so the engine starts from prior context,
      // not a blank slate.  Without this, sessions have no actual memory.
      conversationHistory: [...this.history],
    })

    // Store turn in history
    this.history.push({ role: 'user', content: prompt })
    this.history.push({ role: 'assistant', content: result.response })

    // Prune oldest messages if we've exceeded maxTurns.
    // Each turn = 1 user + 1 assistant message = 2 entries.
    // We slice from the front, preserving the most recent context.
    const maxEntries = this.maxTurns * 2
    if (this.history.length > maxEntries) {
      this.history = this.history.slice(this.history.length - maxEntries)
    }

    return result
  }

  /** Get full conversation history for this session */
  getHistory(): Message[] {
    return [...this.history]
  }

  /** Clear history — start fresh conversation but keep same sessionId */
  clearHistory(): void {
    this.history = []
  }

  /** Number of user turns in this session */
  get turns(): number {
    return this.history.filter(m => m.role === 'user').length
  }
}
