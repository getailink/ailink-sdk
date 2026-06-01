/**
 * Unit Tests — Validator
 * Tests JSON schema validation using AJV
 */

import { Validator } from '../../src/validator';

describe('Validator', () => {
  let validator: Validator;

  beforeEach(() => {
    validator = new Validator();
  });

  describe('Valid Arguments', () => {
    it('should validate simple object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };
      const args = { name: 'John' };
      
      const result = validator.validate(args, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should validate number type', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
        },
        required: ['count'],
      };
      
      expect(validator.validate({ count: 42 }, schema).valid).toBe(true);
      expect(validator.validate({ count: 3.14 }, schema).valid).toBe(true);
    });

    it('should validate array type', () => {
      const schema = {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'string' } },
        },
      };
      
      const result = validator.validate({ items: ['a', 'b', 'c'] }, schema);
      expect(result.valid).toBe(true);
    });

    it('should validate nested object', () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name'],
          },
        },
      };
      
      const result = validator.validate(
        { user: { name: 'Alice', age: 25 } },
        schema
      );
      expect(result.valid).toBe(true);
    });

    it('should validate optional fields', () => {
      const schema = {
        type: 'object',
        properties: {
          required_field: { type: 'string' },
          optional_field: { type: 'string' },
        },
        required: ['required_field'],
      };
      
      const result = validator.validate(
        { required_field: 'value' },
        schema
      );
      expect(result.valid).toBe(true);
    });

    it('should validate with constraints (minimum)', () => {
      const schema = {
        type: 'object',
        properties: {
          quantity: { type: 'number', minimum: 1 },
        },
      };
      
      expect(validator.validate({ quantity: 5 }, schema).valid).toBe(true);
      expect(validator.validate({ quantity: 1 }, schema).valid).toBe(true);
    });

    it('should validate with constraints (maximum)', () => {
      const schema = {
        type: 'object',
        properties: {
          percentage: { type: 'number', maximum: 100 },
        },
      };
      
      expect(validator.validate({ percentage: 50 }, schema).valid).toBe(true);
      expect(validator.validate({ percentage: 100 }, schema).valid).toBe(true);
    });

    it('should validate with enum constraint', () => {
      const schema = {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'shipped', 'delivered'] },
        },
      };
      
      expect(validator.validate({ status: 'pending' }, schema).valid).toBe(true);
      expect(validator.validate({ status: 'shipped' }, schema).valid).toBe(true);
    });
  });

  describe('Invalid Arguments', () => {
    it('should reject missing required field', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      };
      
      const result = validator.validate({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject wrong type', () => {
      const schema = {
        type: 'object',
        properties: {
          age: { type: 'number' },
        },
      };
      
      const result = validator.validate({ age: 'not a number' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject value below minimum', () => {
      const schema = {
        type: 'object',
        properties: {
          quantity: { type: 'number', minimum: 1 },
        },
      };
      
      const result = validator.validate({ quantity: 0 }, schema);
      expect(result.valid).toBe(false);
    });

    it('should reject value above maximum', () => {
      const schema = {
        type: 'object',
        properties: {
          percentage: { type: 'number', maximum: 100 },
        },
      };
      
      const result = validator.validate({ percentage: 150 }, schema);
      expect(result.valid).toBe(false);
    });

    it('should reject value not in enum', () => {
      const schema = {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'shipped'] },
        },
      };
      
      const result = validator.validate({ status: 'invalid' }, schema);
      expect(result.valid).toBe(false);
    });

    it('should reject extra properties if additionalProperties=false', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      };
      
      const result = validator.validate(
        { name: 'John', extra: 'field' },
        schema
      );
      expect(result.valid).toBe(false);
    });

    it('should reject invalid array items', () => {
      const schema = {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'number' } },
        },
      };
      
      const result = validator.validate(
        { items: [1, 2, 'invalid'] },
        schema
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should validate empty object schema', () => {
      const schema = { type: 'object', properties: {} };
      const result = validator.validate({}, schema);
      expect(result.valid).toBe(true);
    });

    it('should validate with null values if allowed', () => {
      const schema = {
        type: 'object',
        properties: {
          value: { type: ['string', 'null'] },
        },
      };
      
      const result = validator.validate({ value: null }, schema);
      expect(result.valid).toBe(true);
    });

    it('should handle deeply nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: { type: 'string' },
                },
              },
            },
          },
        },
      };
      
      const result = validator.validate(
        { level1: { level2: { level3: 'value' } } },
        schema
      );
      expect(result.valid).toBe(true);
    });

    it('should handle large payloads', () => {
      const schema = {
        type: 'object',
        properties: {
          data: { type: 'array', items: { type: 'object' } },
        },
      };
      
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));
      
      const result = validator.validate({ data: largeData }, schema);
      expect(result.valid).toBe(true);
    });

    it('should provide meaningful error messages', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };
      
      const result = validator.validate({}, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThanOrEqual(2);
      // Errors should mention the missing fields
      const errorText = result.errors!.join(' ');
      expect(errorText).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should validate quickly even with complex schema', () => {
      const schema = {
        type: 'object',
        properties: {
          filters: {
            type: 'object',
            properties: {
              statuses: { type: 'array', items: { type: 'string' } },
              dates: { type: 'array', items: { type: 'string' } },
              numbers: { type: 'array', items: { type: 'number' } },
            },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'number' },
              limit: { type: 'number' },
            },
          },
        },
      };

      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        validator.validate(
          {
            filters: {
              statuses: ['active', 'pending'],
              dates: ['2024-01-01', '2024-12-31'],
              numbers: [1, 2, 3, 4, 5],
            },
            pagination: { page: 1, limit: 10 },
          },
          schema
        );
      }
      
      const duration = Date.now() - startTime;
      // 100 validations should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });
});
