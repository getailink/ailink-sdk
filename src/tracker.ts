// ─────────────────────────────────────────────
// AILink — Usage Tracker
// Fire and forget — never blocks, never throws.
// ─────────────────────────────────────────────

import { UsageLog } from './types'

export class Tracker {
  constructor(
    private platformKey: string | undefined,
    private platformUrl: string = 'https://logs.ailink.com/v1'
  ) {}

  track(log: UsageLog): void {
    const payload = {
      prompt: log.prompt,
      toolsCalled: log.toolsCalled,
      allowedTools: log.allowedTools,
      provider: log.provider,
      executionTime: log.executionTime,
      success: log.success,
      error: log.error ?? null,
      timestamp: log.timestamp,
      sessionId: log.sessionId ?? null,
      userRole: log.userRole,
      groups: log.groups ?? null
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (this.platformKey) {
      headers['Authorization'] = `Bearer ${this.platformKey}`
    }

    fetch(`${this.platformUrl}/logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }).catch(() => {
      // Silent fail — platform issues must never affect developer's app
    })
  }
}
