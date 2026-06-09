// ─────────────────────────────────────────────
// AILink — Gemini Provider Adapter
// Package: @google/generative-ai
// Default model: gemini-1.5-flash
// ─────────────────────────────────────────────

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { ProviderAdapter } from './base'
import { Message, ProviderResponse } from '../types'

export class GeminiAdapter implements ProviderAdapter {
  readonly name = 'gemini'
  private client!: GoogleGenerativeAI
  private modelName: string = 'gemini-1.5-flash'  // Fix 2: gemini-1.5-flash for reliable free tier

  initialize(providerKey: string, model?: string): void {
    if (model) this.modelName = model
    this.client = new GoogleGenerativeAI(providerKey)
  }

  async execute(messages: Message[], tools: object[]): Promise<ProviderResponse> {
    // Convert tools to Gemini functionDeclarations format
    const geminiTools = tools.length > 0 ? [{
      functionDeclarations: (tools as any[]).map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'OBJECT',
          properties: tool.parameters?.properties ?? {},
          required: tool.parameters?.required ?? [],
        },
      })),
    }] : []

    const modelInstance = this.client.getGenerativeModel({
      model: this.modelName,
      ...(geminiTools.length > 0 && { tools: geminiTools as any }),
    })

    // Convert messages to Gemini history format
    const history = messages.slice(0, -1).map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'function' as const,
          parts: [{
            functionResponse: {
              name: msg.toolName!,
              response: msg.toolResult,
            },
          }],
        }
      }
      // Assistant message with tool calls — convert to Gemini functionCall parts
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: 'model' as const,
          parts: msg.toolCalls.map(tc => ({
            functionCall: {
              name: tc.toolName,
              args: tc.toolArgs ?? {}
            }
          }))
        }
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || JSON.stringify(msg.toolResult ?? '') }],
      }
    })

    const lastMessage = messages[messages.length - 1]
    const chat = modelInstance.startChat({ history })
    const result = await chat.sendMessage(lastMessage.content)
    const response = result.response

    const promptTokens = response.usageMetadata?.promptTokenCount ?? null
    const completionTokens = response.usageMetadata?.candidatesTokenCount ?? null

    // Handle parallel tool calls
    const functionCalls = response.functionCalls?.() ?? []

    if (functionCalls.length === 1) {
      return {
        type: 'tool_call',
        toolName: functionCalls[0].name,
        toolArgs: functionCalls[0].args as Record<string, any>,
        callId: `gemini-call-0`,  // Gemini doesn't provide IDs — assign sequential ones
        promptTokens,
        completionTokens
      }
    }

    if (functionCalls.length > 1) {
      return {
        type: 'tool_calls',
        toolCalls: functionCalls.map((fc, i) => ({
          toolName: fc.name,
          toolArgs: fc.args as Record<string, any>,
          callId: `gemini-call-${i}`  // Sequential IDs for parallel calls
        })),
        promptTokens,
        completionTokens
      }
    }

    return { type: 'text', text: response.text(), promptTokens, completionTokens }
  }
}
