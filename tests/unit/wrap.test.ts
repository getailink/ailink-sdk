/**
 * Unit Tests — AILink.wrap()
 * Verifies observability wrapping: pass-through behavior, tracking calls,
 * name resolution (including .bind() destruction), role forwarding, and
 * error propagation.
 */

import { AILink } from '../../src/ailink';

// ── Shared fetch mock — tracker.track() fires fetch internally ──────────────
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Helper: build a fresh AILink instance and spy on tracker.track ──────────
function makeAI() {
  const ai = new AILink({ provider: 'groq', providerKey: 'test-key' });
  // tracker is private — use bracket notation as instructed
  const trackSpy = jest.spyOn(ai['tracker'], 'track').mockImplementation(() => {});
  return { ai, trackSpy };
}

describe('AILink.wrap()', () => {
  // ── Test 1: wrapped function returns correct result ────────────────────────
  it('returns the correct result from the wrapped function', async () => {
    const { ai } = makeAI();
    const fn = async (x: number) => x * 2;
    const wrapped = ai.wrap(fn);

    const result = await wrapped(21);

    expect(result).toBe(42);
  });

  // ── Test 2: tracker.track called on success with correct fields ────────────
  it('calls tracker.track with success: true, correct toolsCalled, userRole, and groups: null', async () => {
    const { ai, trackSpy } = makeAI();
    const fn = async function myTool() { return 'ok'; };
    const wrapped = ai.wrap(fn);

    await wrapped();

    expect(trackSpy).toHaveBeenCalledTimes(1);
    const payload = trackSpy.mock.calls[0][0];
    expect(payload.toolsCalled).toEqual(['myTool']);
    expect(payload.allowedTools).toEqual(['myTool']);
    expect(payload.success).toBe(true);
    expect(payload.userRole).toBe('user');
    expect(payload.groups).toBeNull();
  });

  // ── Test 3: toolName defaults to fn.name when no options passed ────────────
  it('defaults toolName to fn.name for a named function', async () => {
    const { ai, trackSpy } = makeAI();
    async function namedFunction() { return 'result'; }
    const wrapped = ai.wrap(namedFunction);

    await wrapped();

    const payload = trackSpy.mock.calls[0][0];
    expect(payload.prompt).toBe('namedFunction');
    expect(payload.toolsCalled).toEqual(['namedFunction']);
  });

  // ── Test 4: toolName defaults to 'anonymous' when fn.name is empty ────────
  // In LangChain, chain.invoke.bind(chain) makes fn.name useless.
  // wrap() guards against this with: fn.name || 'anonymous'
  // We simulate a function with empty .name via Object.defineProperty.
  it("defaults toolName to 'anonymous' when fn.name is empty string", async () => {
    const { ai, trackSpy } = makeAI();
    const fn = async () => 'result';
    // Simulate .bind() name destruction — force fn.name to empty string
    Object.defineProperty(fn, 'name', { value: '', configurable: true });
    expect(fn.name).toBe(''); // precondition
    const wrapped = ai.wrap(fn);

    await wrapped();

    const payload = trackSpy.mock.calls[0][0];
    expect(payload.prompt).toBe('anonymous');
    expect(payload.toolsCalled).toEqual(['anonymous']);
  });

  // ── Test 5: options.toolName overrides fn.name ────────────────────────────
  it('uses options.toolName over fn.name when explicitly provided', async () => {
    const { ai, trackSpy } = makeAI();
    async function originalName() { return 'ok'; }
    const wrapped = ai.wrap(originalName, { toolName: 'ProductRagChain' });

    await wrapped();

    const payload = trackSpy.mock.calls[0][0];
    expect(payload.prompt).toBe('ProductRagChain');
    expect(payload.toolsCalled).toEqual(['ProductRagChain']);
  });

  // ── Test 6: options.role is forwarded to tracker as userRole ──────────────
  it('passes options.role to tracker as userRole', async () => {
    const { ai, trackSpy } = makeAI();
    const fn = async () => 'ok';
    const wrapped = ai.wrap(fn, { toolName: 'AdminTool', role: 'admin' });

    await wrapped();

    const payload = trackSpy.mock.calls[0][0];
    expect(payload.userRole).toBe('admin');
  });

  // ── Test 7: tracker.track called with success: false on throw ─────────────
  it('calls tracker.track with success: false and the error message when fn throws', async () => {
    const { ai, trackSpy } = makeAI();
    const fn = async () => { throw new Error('downstream failure'); };
    const wrapped = ai.wrap(fn, { toolName: 'FailingChain' });

    await expect(wrapped()).rejects.toThrow('downstream failure');

    expect(trackSpy).toHaveBeenCalledTimes(1);
    const payload = trackSpy.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('downstream failure');
  });

  // ── Test 8: original error is re-thrown after tracking ────────────────────
  it('re-throws the original error after tracking, preserving error type', async () => {
    const { ai } = makeAI();
    const originalError = new TypeError('type mismatch');
    const fn = async () => { throw originalError; };
    const wrapped = ai.wrap(fn, { toolName: 'TypeErrorChain' });

    await expect(wrapped()).rejects.toBe(originalError);
  });

  // ── Test 9: original arguments are passed through to fn unchanged ──────────
  it('passes all original arguments to fn without modification', async () => {
    const { ai } = makeAI();
    const capturedArgs: any[] = [];
    const fn = async (...args: any[]) => {
      capturedArgs.push(...args);
      return 'done';
    };
    const wrapped = ai.wrap(fn, { toolName: 'ArgPassthrough' });

    await wrapped('hello', 42, { nested: true });

    expect(capturedArgs).toEqual(['hello', 42, { nested: true }]);
  });
});
