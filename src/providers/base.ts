// ─────────────────────────────────────────────
// AILink — Base Provider Adapter Interface
// Every provider must implement this.
// ─────────────────────────────────────────────

import { Message, ProviderResponse } from '../types'

export interface ProviderAdapter {
  readonly name: string
  initialize(providerKey: string, model?: string): void
  execute(messages: Message[], tools: object[]): Promise<ProviderResponse>
}
