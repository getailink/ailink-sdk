// ─────────────────────────────────────────────
// AILink — Execution Engine
// Runs agentic loop with role filtering,
// group filtering, and parallel tool execution.
// Max 10 iterations. Never crashes.
// ─────────────────────────────────────────────

import { FunctionRegistry } from './registry'
import { ProviderAdapter } from './providers/base'
import { Validator } from './validator'
import { Message, RunOptions, RoleName, ToolCall, AILinkConfig } from './types'
import { EmptyGroupError } from './errors'

export interface EngineResult {
  response: string
  toolsCalled: string[]
  allowedTools: string[]
  executionTime: number
  userRole: RoleName
  groups: string[] | null
}

export class Engine {
  constructor(
    private registry: FunctionRegistry,
    private provider: ProviderAdapter,
    private validator: Validator,
    private debug: boolean = false,
    private config: Partial<AILinkConfig> = {}
  ) {}

  async run(prompt: string, options?: RunOptions): Promise<EngineResult> {
    const startTime = Date.now()
    const role = options?.userRole ?? 'user'
    const groups = options?.groups && options.groups.length > 0
      ? options.groups
      : undefined

    // ── Step 1: Filter tools by role and group ──────────────────────
    const filteredTools = this.registry.getFiltered(role, groups)

    if (groups && filteredTools.length === 0) {
      throw new EmptyGroupError(groups)
    }

    const allowedToolNames = filteredTools.map(t => t.name)
    const toolSchemas = this.registry.exportSchema(filteredTools)

    if (this.debug) {
      console.log(`[AILink Engine] Role: ${role} | Groups: ${groups?.join(',') ?? 'all'} | Tools: ${allowedToolNames.join(', ') || 'none'}`)
    }

    // ── Step 2: Initialize history ──────────────────────────────────
    // Prepend any prior conversation turns supplied by AILinkSession
    // (or a custom caller managing their own history).  Without this,
    // every engine run starts fresh and sessions have no memory.
    const history: Message[] = [
      ...(options?.conversationHistory ?? []),
      { role: 'user', content: prompt }
    ]
    const toolsCalled: string[] = []

    // ── Step 3: Agentic loop ────────────────────────────────────────
    const maxIterations = this.config.maxIterations ?? 10
    for (let i = 0; i < maxIterations; i++) {
      const response = await this.provider.execute(history, toolSchemas)

      // Final text — done
      if (response.type === 'text') {
        if (this.debug) console.log(`[AILink Engine] Final: ${response.text}`)
        return {
          response: response.text!,
          toolsCalled,
          allowedTools: allowedToolNames,
          executionTime: Date.now() - startTime,
          userRole: role,
          groups: groups ?? null
        }
      }

      // Normalize to array of tool calls (handles both single and parallel)
      let calls: ToolCall[] = []
      if (response.type === 'tool_calls' && response.toolCalls) {
        calls = response.toolCalls
      } else if (response.type === 'tool_call' && response.toolName) {
        calls = [{ toolName: response.toolName, toolArgs: response.toolArgs ?? {}, callId: response.callId }]
      }

      if (calls.length === 0) break

      // ── CRITICAL: Push assistant message with tool calls FIRST ──
      // Groq and OpenAI require the assistant message that contains
      // the tool_calls array to appear in history BEFORE the tool
      // results. Without this, they see a result with no matching
      // question and keep calling the tool in an infinite loop.
      history.push({
        role: 'assistant',
        content: '',
        toolCalls: calls,
      })

      if (this.debug) {
        console.log(`[AILink Engine] Executing ${calls.length} tool(s) in parallel: ${calls.map(c => c.toolName).join(', ')}`)
      }

      // ── Parallel tool execution ─────────────────────────────────
      const toolResults = await Promise.all(
        calls.map(async (call) => {
          if (!allowedToolNames.includes(call.toolName)) {
            return { callId: call.callId, toolName: call.toolName, result: null, error: `Tool "${call.toolName}" is not allowed for role "${role}" or selected groups` }
          }

          const tool = this.registry.get(call.toolName)

          if (!tool) {
            return { callId: call.callId, toolName: call.toolName, result: null, error: `Tool "${call.toolName}" is not registered` }
          }

          // Use pre-compiled validator from registration — avoids recompiling schema on every call
          let validationPassed = true
          let validationErrors: string[] | undefined
          if (tool.compiledValidator) {
            const valid = tool.compiledValidator(call.toolArgs)
            if (!valid) {
              validationPassed = false
              validationErrors = (tool.compiledValidator as any).errors?.map((e: any) => {
                const field = e.instancePath ? e.instancePath.replace('/', '') : 'input'
                return `${field}: ${e.message}`
              }) ?? ['Invalid arguments']
            }
          } else {
            // Fallback to runtime validation if compiledValidator is absent
            const validation = this.validator.validate(call.toolArgs, tool.schema)
            validationPassed = validation.valid
            validationErrors = validation.errors
          }

          if (!validationPassed) {
            return { callId: call.callId, toolName: call.toolName, result: null, error: `Invalid arguments: ${validationErrors?.join(', ')}` }
          }

          try {
            const result = await tool.execute(call.toolArgs)
            toolsCalled.push(call.toolName)
            if (this.debug) console.log(`[AILink Engine] ${call.toolName} result:`, result)
            return { callId: call.callId, toolName: call.toolName, result, error: null }
          } catch (err: any) {
            return { callId: call.callId, toolName: call.toolName, result: null, error: err?.message ?? 'Tool execution failed' }
          }
        })
      )

      // Add all results to history
      for (const tr of toolResults) {
        history.push({
          role: 'tool',
          content: tr.error ? `Error: ${tr.error}` : JSON.stringify(tr.result),
          toolName: tr.toolName,
          toolResult: tr.error ? null : tr.result,
          callId: tr.callId, // Thread exact provider-generated ID back for Turn 2
        })
      }
    }

    // Max iterations reached
    return {
      response: 'Unable to complete the request within the allowed steps.',
      toolsCalled,
      allowedTools: allowedToolNames,
      executionTime: Date.now() - startTime,
      userRole: role,
      groups: groups ?? null
    }
  }
}
