// ─────────────────────────────────────────────
// AILink — OpenAI Provider Adapter
// Package: openai
// Default model: gpt-4o-mini
// ─────────────────────────────────────────────

import OpenAI from 'openai'
import { ProviderAdapter } from './base'
import { Message, ProviderResponse } from '../types'

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = 'openai'
  private client!: OpenAI
  private modelName: string = 'gpt-4o-mini'

  initialize(providerKey: string, model?: string): void {
    if (model) this.modelName = model
    this.client = new OpenAI({ apiKey: providerKey })
  }

  async execute(messages: Message[], tools: object[]): Promise<ProviderResponse> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: JSON.stringify(msg.toolResult),
          tool_call_id: msg.callId!, // Exact ID from provider — fake fallback causes 400 on Turn 2
        }
      }
      if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          return {
            role: 'assistant' as const,
            content: null,
            tool_calls: msg.toolCalls.map(tc => ({
              id: tc.callId ?? `call_${tc.toolName}`,
              type: 'function' as const,
              function: {
                name: tc.toolName,
                arguments: JSON.stringify(tc.toolArgs ?? {})
              }
            }))
          }
        }
        return { role: 'assistant' as const, content: msg.content }
      }
      return { role: 'user' as const, content: msg.content }
    })

    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = (tools as any[]).map(tool => ({
      type: 'function' as const,
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }))

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: openaiMessages,
      ...(openaiTools.length > 0 && { tools: openaiTools }),
    })

    const choice = response.choices[0]

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      // Single tool call
      if (choice.message.tool_calls.length === 1) {
        const call = choice.message.tool_calls[0]
        return {
          type: 'tool_call',
          toolName: call.function.name,
          toolArgs: JSON.parse(call.function.arguments || '{}'),
          callId: call.id
        }
      }
      // Parallel tool calls
      return {
        type: 'tool_calls',
        toolCalls: choice.message.tool_calls.map(call => ({
          toolName: call.function.name,
          toolArgs: JSON.parse(call.function.arguments || '{}'),
          callId: call.id
        }))
      }
    }

    return { type: 'text', text: choice.message.content || '' }
  }
}
