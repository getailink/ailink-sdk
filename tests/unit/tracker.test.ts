/**
 * Unit Tests — Usage Tracker
 * Tests fire-and-forget usage logging behavior
 */

import { Tracker } from '../../src/tracker';
import { UsageLog } from '../../src/types';

describe('Tracker (Usage Logging)', () => {
  let tracker: Tracker;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    tracker = new Tracker('test-api-key');
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Fire-and-Forget Behavior', () => {
    it('should not throw on successful POST', () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test prompt',
        toolsCalled: [],
        allowedTools: [],
        provider: 'gemini',
        userRole: 'user',
        executionTime: 100,
        success: true,
        timestamp: new Date().toISOString(),
        groups: [],
      };

      // Should not throw
      expect(() => tracker.track(log)).not.toThrow();
    });

    it('should not throw on network error', () => {
      global.fetch = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test prompt',
        toolsCalled: [],
        allowedTools: [],
        provider: 'gemini',
        userRole: 'user',
        executionTime: 100,
        success: true,
        timestamp: new Date().toISOString(),
        groups: [],
      };

      // Should not throw
      expect(() => tracker.track(log)).not.toThrow();
    });

    it('should not throw on HTTP error status', () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test prompt',
        toolsCalled: [],
        allowedTools: [],
        provider: 'gemini',
        userRole: 'user',
        executionTime: 100,
        success: true,
        timestamp: new Date().toISOString(),
        groups: [],
      };

      // Should not throw
      expect(() => tracker.track(log)).not.toThrow();
    });

    it('should not throw on malformed response', () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test prompt',
        toolsCalled: [],
        allowedTools: [],
        provider: 'gemini',
        userRole: 'user',
        executionTime: 100,
        success: true,
        timestamp: new Date().toISOString(),
        groups: [],
      };

      // Should not throw
      expect(() => tracker.track(log)).not.toThrow();
    });
  });

  describe('Request Format', () => {
    it('should POST to platform URL', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: ['tool1'],
        allowedTools: ['tool1', 'tool2'],
        executionTime: 150,
        provider: 'gemini',
        userRole: 'admin',
        groups: ['inventory'],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);

      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      
      expect(url).toContain('logs.ailink.com');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Authorization']).toBeDefined();
    });

    it('should include result data in request body', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test prompt',
        toolsCalled: ['checkInventory'],
        allowedTools: ['checkInventory', 'getOrderStatus'],
        executionTime: 245,
        provider: 'openai',
        userRole: 'user',
        groups: ['inventory', 'orders'],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      
      expect(body.prompt).toBe('test prompt');
      expect(body.toolsCalled).toEqual(['checkInventory']);
      expect(body.allowedTools).toEqual(['checkInventory', 'getOrderStatus']);
      expect(body.executionTime).toBe(245);
      expect(body.provider).toBe('openai');
      expect(body.userRole).toBe('user');
      expect(body.groups).toEqual(['inventory', 'orders']);
    });

    it('should include timestamp in request', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('string');
    });
  });

  describe('Logging Multiple Results', () => {
    it('should handle multiple log calls', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const tracker = new Tracker('test-key');
      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);
      tracker.track(log);
      tracker.track(log);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid consecutive calls', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const tracker = new Tracker('test-key');
      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);
      tracker.track(log);
      tracker.track(log);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Data Integrity', () => {
    it('should log empty arrays correctly', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.toolsCalled).toEqual([]);
      expect(body.allowedTools).toEqual([]);
      expect(body.groups).toEqual([]);
    });

    it('should log multiple tools correctly', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: ['tool1', 'tool2', 'tool3'],
        allowedTools: ['tool1', 'tool2', 'tool3', 'tool4', 'tool5'],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'admin',
        groups: ['group1', 'group2', 'group3'],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.toolsCalled).toEqual(['tool1', 'tool2', 'tool3']);
      expect(body.allowedTools).toEqual(['tool1', 'tool2', 'tool3', 'tool4', 'tool5']);
      expect(body.groups).toEqual(['group1', 'group2', 'group3']);
    });

    it('should handle special characters in response', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const specialResponse = 'Response with "quotes", \\backslash, and \n newlines';
      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: specialResponse,
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.prompt).toBe(specialResponse);
    });

    it('should handle large response text', () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const largeResponse = 'x'.repeat(10000);
      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: largeResponse,
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      tracker.track(log);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.prompt.length).toBe(10000);
    });
  });

  describe('Non-Blocking Behavior', () => {
    it('should complete immediately without waiting for network', async () => {
      const slowPromise = new Promise<{ ok: boolean }>(resolve => {
        // Never resolves — simulates a permanently hanging network request.
        // No timer needed. No open handles. Jest exits cleanly after this test.
      });

      const mockFetch = jest.fn().mockReturnValue(slowPromise);
      global.fetch = mockFetch;

      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      const startTime = Date.now();
      tracker.track(log);
      const duration = Date.now() - startTime;

      // Track should complete immediately, not wait for network response
      expect(duration).toBeLessThan(1000); // Should be nearly instant
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Platform URL Configuration', () => {
    it('should use platform URL from constructor', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const customTracker = new Tracker('test-key', 'https://custom.platform.com/logs');
      const log: UsageLog = {
        platformKey: 'test-key',
        prompt: 'test',
        toolsCalled: [],
        allowedTools: [],
        executionTime: 100,
        provider: 'gemini',
        userRole: 'user',
        groups: [],
        success: true,
        timestamp: new Date().toISOString(),
      };

      customTracker.track(log);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('custom.platform.com');
    });
  });
});
