/**
 * Mock Provider Adapter for Testing
 * Simulates provider behavior without external API calls
 */

import { ProviderAdapter } from '../../src/providers/base';
import { Message, ProviderResponse } from '../../src/types';

export class MockProviderAdapter implements ProviderAdapter {
  readonly name = 'mock';

  private response: ProviderResponse | null = null;
  private toolResults: Map<string, any> = new Map();
  private callSequence: ProviderResponse[] = [];
  private currentCallIndex = 0;
  private dynamicResponseFn: (() => ProviderResponse) | null = null;
  private error: Error | null = null;

  async initialize(platformKey: string): Promise<void> {
    // No-op for mock
  }

  async execute(
    history: Message[],
    toolSchemas: any[]
  ): Promise<ProviderResponse> {
    if (this.error) {
      throw this.error;
    }

    if (this.dynamicResponseFn) {
      return this.dynamicResponseFn();
    }

    if (this.callSequence.length > 0 && this.currentCallIndex < this.callSequence.length) {
      return this.callSequence[this.currentCallIndex++];
    }

    if (!this.response) {
      return { type: 'text', text: 'No response configured' };
    }

    const hasToolResult = history.some(message => message.role === 'tool');

    // If the engine already executed a tool, return the provider's final answer.
    if (this.response.type === 'tool_call' && this.response.toolName) {
      const toolName = this.response.toolName;
      if (hasToolResult && this.toolResults.has(toolName)) {
        const toolResult = this.toolResults.get(toolName);
        if (toolResult === null) {
          // Error case - provider returns error response
          return {
            type: 'text',
            text: `Tool execution failed: ${toolName}`,
          };
        }

        // Convert tool result to text response for next iteration
        const lastFinalResponse = this.response as any;
        if (lastFinalResponse._finalResponse) {
          return {
            type: 'text',
            text: lastFinalResponse._finalResponse,
          };
        }

        // Move to final response
        return {
          type: 'text',
          text: `Tool ${toolName} returned: ${JSON.stringify(toolResult)}`,
        };
      }
    }

    if (this.response.type === 'tool_calls' && hasToolResult) {
      const lastFinalResponse = this.response as any;
      if (lastFinalResponse._finalResponse) {
        return {
          type: 'text',
          text: lastFinalResponse._finalResponse,
        };
      }

      return {
        type: 'text',
        text: `Tools returned: ${JSON.stringify(
          history
            .filter(message => message.role === 'tool')
            .map(message => ({ toolName: message.toolName, result: message.toolResult }))
        )}`,
      };
    }

    return this.response;
  }

  // Test helper methods
  setResponse(response: ProviderResponse): void {
    this.response = response;
    this.callSequence = [];
    this.currentCallIndex = 0;
  }

  setToolResult(toolName: string, result: any): void {
    this.toolResults.set(toolName, result);
  }

  setFinalResponse(text: string): void {
    if (this.response) {
      (this.response as any)._finalResponse = text;
    }
  }

  setCallSequence(sequence: ProviderResponse[]): void {
    this.callSequence = sequence;
    this.currentCallIndex = 0;
  }

  setDynamicResponse(fn: () => ProviderResponse): void {
    this.dynamicResponseFn = fn;
  }

  setError(error: Error): void {
    this.error = error;
  }

  clearToolResults(): void {
    this.toolResults.clear();
  }

  reset(): void {
    this.response = null;
    this.toolResults.clear();
    this.callSequence = [];
    this.currentCallIndex = 0;
    this.dynamicResponseFn = null;
    this.error = null;
  }
}
