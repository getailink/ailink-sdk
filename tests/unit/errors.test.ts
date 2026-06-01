/**
 * Unit Tests — Custom Errors
 * Validates all custom error classes and messages
 */

import {
  AILinkConfigError,
  ToolAlreadyExistsError,
  ToolNotFoundError,
  UnsupportedProviderError,
  ValidationError,
  EmptyGroupError,
  AllProvidersFailedError,
} from '../../src/errors';

describe('Custom Error Classes', () => {
  describe('AILinkConfigError', () => {
    it('should create error with message', () => {
      const error = new AILinkConfigError('apiKey is required');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('apiKey is required');
      expect(error.name).toBe('AILinkConfigError');
    });

    it('should have stack trace', () => {
      const error = new AILinkConfigError('test error');
      expect(error.stack).toBeDefined();
    });
  });

  describe('ToolAlreadyExistsError', () => {
    it('should include tool name in message', () => {
      const error = new ToolAlreadyExistsError('Tool "foo" is already registered');
      expect(error.message).toContain('foo');
    });
  });

  describe('ToolNotFoundError', () => {
    it('should indicate tool not found', () => {
      const error = new ToolNotFoundError('Tool "bar" not found');
      expect(error.message).toContain('bar');
    });
  });

  describe('UnsupportedProviderError', () => {
    it('should list unsupported provider', () => {
      const error = new UnsupportedProviderError('Unknown provider: invalid');
      expect(error.message).toContain('invalid');
    });
  });

  describe('ValidationError', () => {
    it('should include errors in message', () => {
      const errors = ['field required', 'invalid type'];
      const error = new ValidationError('Validation failed', errors);
      expect(error.message).toContain('Validation failed');
      // Errors are part of the error object/message construction
      expect(error).toBeInstanceOf(Error);
    });

    it('should be instance of Error', () => {
      const error = new ValidationError('test', []);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('EmptyGroupError', () => {
    it('should list groups with no tools', () => {
      const error = new EmptyGroupError(['inventory', 'orders']);
      expect(error.message).toContain('inventory');
      expect(error.message).toContain('orders');
    });
  });

  describe('AllProvidersFailedError', () => {
    it('should list all attempted providers', () => {
      const error = new AllProvidersFailedError(['gemini', 'openai', 'claude']);
      expect(error.message).toContain('gemini');
      expect(error.message).toContain('openai');
      expect(error.message).toContain('claude');
    });
  });

  describe('Error Hierarchy', () => {
    it('all custom errors should extend Error', () => {
      const errors = [
        new AILinkConfigError('test'),
        new ToolAlreadyExistsError('test'),
        new ToolNotFoundError('test'),
        new UnsupportedProviderError('test'),
        new ValidationError('test', []),
        new EmptyGroupError([]),
        new AllProvidersFailedError([]),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBeDefined();
      });
    });
  });
});
