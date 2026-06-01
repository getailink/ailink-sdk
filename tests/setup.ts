/**
 * Jest Setup File
 * Runs before all tests
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.test for testing
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs in tests unless DEBUG=true
if (process.env.TEST_DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
  };
}

// Custom matchers
expect.extend({
  toBeValidJSON(received: any) {
    try {
      JSON.parse(JSON.stringify(received));
      return {
        message: () => `expected ${received} not to be valid JSON`,
        pass: true,
      };
    } catch (e) {
      return {
        message: () => `expected ${received} to be valid JSON`,
        pass: false,
      };
    }
  },
});

// Global setup
beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

// Global teardown
afterAll(() => {
  jest.clearAllMocks();
});
