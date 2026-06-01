// ─────────────────────────────────────────────
// AILink — Groq Provider Adapter
// Package: groq-sdk
// Default model: llama-3.1-70b-versatile
// Groq uses OpenAI-compatible format
// ─────────────────────────────────────────────

import Groq from 'groq-sdk'
import { ProviderAdapter } from './base'
import { Message, ProviderResponse } from '../types'

export class GroqAdapter implements ProviderAdapter {
  readonly name = 'groq'
  private client!: Groq
  private modelName: string = 'llama-3.3-70b-versatile'  // llama-3.1-70b-versatile was deprecated Jan 2025

  initialize(providerKey: string, model?: string): void {
    if (model) this.modelName = model
    this.client = new Groq({ apiKey: providerKey })
  }

  async execute(messages: Message[], tools: object[]): Promise<ProviderResponse> {
    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: JSON.stringify(msg.toolResult),
          tool_call_id: msg.callId!, // Exact ID from provider — msg.toolName here causes 400 on Turn 2
        }
      }
      if (msg.role === 'assistant') {
        // If this assistant message contains tool calls, format them
        // in Groq's native tool_calls array format. Without this,
        // Groq sees the tool results but not the matching assistant
        // message and loops forever calling the same tool.
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

    const groqTools: Groq.Chat.ChatCompletionTool[] = (tools as any[]).map(tool => ({
      type: 'function' as const,
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }))

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: groqMessages,
      ...(groqTools.length > 0 && { tools: groqTools }),
    })

    const choice = response.choices[0]

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      if (choice.message.tool_calls.length === 1) {
        const call = choice.message.tool_calls[0]
        return {
          type: 'tool_call',
          toolName: call.function.name,
          toolArgs: JSON.parse(call.function.arguments || '{}'),
          callId: call.id
        }
      }
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
