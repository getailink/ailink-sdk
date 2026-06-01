// ─────────────────────────────────────────────
// AILink — Function Registry
// ─────────────────────────────────────────────

import { AILinkTool, RoleName, RegisterOptions } from './types'
import { ToolAlreadyExistsError, ToolNotFoundError } from './errors'
import Ajv from 'ajv'

// Single Ajv instance shared across all registrations — never re-instantiated
const ajv = new Ajv({ allErrors: true, coerceTypes: true })

export class FunctionRegistry {
  private tools: Map<string, AILinkTool> = new Map()

  /**
   * Register a function as an AI-callable tool.
   * @param name - Unique tool name (camelCase, no spaces)
   * @param description - What this tool does. AI reads this to decide when to call it.
   * @param schema - JSON Schema describing input parameters
   * @param execute - The function to run when AI calls this tool
   * @param options - Optional: roles (who can use this), group (logical category)
   */
  register(
    name: string,
    description: string,
    schema: Record<string, any>,
    execute: (args: any) => Promise<any>,
    options?: RegisterOptions
  ): void {
    if (this.tools.has(name)) {
      throw new ToolAlreadyExistsError(name)
    }

    // Compile schema once here — never recompile on every tool call
    let compiledValidator: ((args: any) => boolean) | undefined
    if (schema && Object.keys(schema).length > 0) {
      try {
        compiledValidator = ajv.compile(schema) as (args: any) => boolean
      } catch {
        // Invalid schema — validation will be skipped at execution time
      }
    }

    this.tools.set(name, {
      name,
      description,
      schema,
      execute,
      roles: options?.roles ?? ['user', 'admin', 'developer'],
      group: options?.group,
      compiledValidator,
    })
  }

  /** Remove a registered tool */
  unregister(name: string): void {
    if (!this.tools.has(name)) {
      throw new ToolNotFoundError(name, this.list())
    }
    this.tools.delete(name)
  }

  /** Get a tool by name */
  get(name: string): AILinkTool | undefined {
    return this.tools.get(name)
  }

  /** Check if a tool exists */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /** List all registered tool names (all roles, all groups) */
  list(): string[] {
    return Array.from(this.tools.keys())
  }

  /** Get ALL tools regardless of role or group */
  getAll(): AILinkTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools filtered by role.
   * Role hierarchy:
   *   'user'      → tools where roles includes 'user'
   *   'admin'     → tools where roles includes 'admin' OR 'user'
   *   'developer' → all tools
   */
  getByRole(role: RoleName): AILinkTool[] {
    return this.getAll().filter(tool => {
      if (role === 'developer') return true
      if (role === 'admin') return tool.roles.includes('admin') || tool.roles.includes('user')
      return tool.roles.includes('user')
    })
  }

  /**
   * Get tools filtered by role AND groups.
   * If groups is undefined or empty, returns all tools for that role.
   * If groups are provided, only returns tools in those groups that match the role.
   */
  getFiltered(role: RoleName, groups?: string[]): AILinkTool[] {
    const byRole = this.getByRole(role)
    if (!groups || groups.length === 0) return byRole
    return byRole.filter(tool =>
      tool.group !== undefined && groups.includes(tool.group)
    )
  }

  /**
   * Export tools as JSON schema array for AI providers.
   * Pass filtered tool list from getFiltered() or getByRole().
   * If no tools passed, exports all.
   */
  exportSchema(tools?: AILinkTool[]): object[] {
    const toolList = tools ?? this.getAll()
    return toolList.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }))
  }
}
