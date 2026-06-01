// ─────────────────────────────────────────────
// AILink — Claude Provider Adapter
// Package: @anthropic-ai/sdk
// Default model: claude-3-5-haiku-latest
// ─────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { ProviderAdapter } from './base'
import { Message, ProviderResponse } from '../types'

export class ClaudeAdapter implements ProviderAdapter {
  readonly name = 'claude'
  private client!: Anthropic
  private modelName: string = 'claude-3-5-haiku-latest'

  initialize(providerKey: string, model?: string): void {
    if (model) this.modelName = model
    this.client = new Anthropic({ apiKey: providerKey })
  }

  async execute(messages: Message[], tools: object[]): Promise<ProviderResponse> {
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'user' as const,
          content: [{
            type: 'tool_result' as const,
            tool_use_id: msg.callId!, // Exact ID from provider — fake fallback crashes Anthropic Turn 2
            content: JSON.stringify(msg.toolResult),
          }],
        }
      }
      if (msg.role === 'assistant') return { role: 'assistant' as const, content: msg.content }
      return { role: 'user' as const, content: msg.content }
    })

    const anthropicTools: Anthropic.Tool[] = (tools as any[]).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters?.properties ?? {},
        required: tool.parameters?.required ?? [],
      },
    }))

    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      messages: anthropicMessages,
      ...(anthropicTools.length > 0 && { tools: anthropicTools }),
    })

    // Handle parallel tool calls
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]

    if (toolUseBlocks.length === 1) {
      return {
        type: 'tool_call',
        toolName: toolUseBlocks[0].name,
        toolArgs: toolUseBlocks[0].input as Record<string, any>,
        callId: toolUseBlocks[0].id
      }
    }

    if (toolUseBlocks.length > 1) {
      return {
        type: 'tool_calls',
        toolCalls: toolUseBlocks.map(b => ({
          toolName: b.name,
          toolArgs: b.input as Record<string, any>,
          callId: b.id
        }))
      }
    }

    const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
    return { type: 'text', text: textBlock?.text ?? '' }
  }
}
