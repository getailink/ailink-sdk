// ─────────────────────────────────────────────
// AILink — Provider Registry
// Maps provider name to adapter instance.
// Add new providers here only — no other file changes.
// ─────────────────────────────────────────────

import { ProviderAdapter } from './base';
import { ProviderName } from '../types';
import { UnsupportedProviderError } from '../errors';
import { GeminiAdapter } from './gemini';
import { OpenAIAdapter } from './openai';
import { ClaudeAdapter } from './claude';
import { GroqAdapter } from './groq';

export function getProvider(name: ProviderName): ProviderAdapter {
  switch (name) {
    case 'gemini': return new GeminiAdapter();
    case 'openai': return new OpenAIAdapter();
    case 'claude': return new ClaudeAdapter();
    case 'groq':   return new GroqAdapter();
    default:       throw new UnsupportedProviderError(name);
  }
}

export type { ProviderAdapter };
