// ─────────────────────────────────────────────
// AILink — Argument Validator
// ─────────────────────────────────────────────

import Ajv, { ValidateFunction } from 'ajv';
import { ValidationResult } from './types';

const ajv = new Ajv({ allErrors: true, coerceTypes: true });

// Module-level cache: JSON-stringified schema → compiled validator.
// Avoids recompiling the same schema on every validate() call.
// This is only a fallback path (registry pre-compiles at registration),
// but correctness demands we don't thrash Ajv in edge cases.
const schemaCache = new Map<string, ValidateFunction>()

export class Validator {
  /**
   * Validate AI-provided arguments against a tool's JSON schema.
   * Called before every tool execution to ensure safe inputs.
   */
  validate(args: Record<string, any>, schema: Record<string, any>): ValidationResult {
    // If schema has no properties defined, skip validation
    if (!schema || Object.keys(schema).length === 0) {
      return { valid: true };
    }

    try {
      const cacheKey = JSON.stringify(schema)
      let validate = schemaCache.get(cacheKey)
      if (!validate) {
        validate = ajv.compile(schema)
        schemaCache.set(cacheKey, validate)
      }

      const valid = validate(args);

      if (valid) {
        return { valid: true };
      }

      const errors = (validate.errors || []).map(err => {
        const field = err.instancePath ? err.instancePath.replace('/', '') : 'input';
        return `${field}: ${err.message}`;
      });

      return { valid: false, errors };
    } catch (err: any) {
      // If schema itself is invalid, skip validation and allow execution
      return { valid: true };
    }
  }
}
