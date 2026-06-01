/**
 * Integration Tests — Session Management
 * Tests AILinkSession history, pruning, and AILink.createSession wiring.
 */

import { AILink } from '../../src/ailink';
import { AILinkResult } from '../../src/types';

const makeResult = (response: string, sessionId?: string): AILinkResult => ({
  response,
  toolsCalled: [],
  allowedTools: [],
  executionTime: 1,
  provider: 'gemini',
  userRole: 'user',
  groups: null,
});

describe('Session Integration', () => {
  describe('Session Creation', () => {
    it('should create new sessions with unique IDs', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      const session1 = ai.createSession();
      const session2 = ai.createSession();

      expect(session1.sessionId).toEqual(expect.any(String));
      expect(session2.sessionId).toEqual(expect.any(String));
      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('should use a caller-provided session ID', () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });

      const session = ai.createSession('customer-chat-123');

      expect(session.sessionId).toBe('customer-chat-123');
    });
  });

  describe('Run Wiring', () => {
    it('should pass sessionId, role, and groups into ai.run', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });
      const runSpy = jest
        .spyOn(ai, 'run')
        .mockResolvedValue(makeResult('Inventory is available'));

      const session = ai.createSession('session-abc');
      const result = await session.run('Check inventory', {
        userRole: 'admin',
        groups: ['inventory'],
      });

      expect(result.response).toBe('Inventory is available');
      expect(runSpy).toHaveBeenCalledWith('Check inventory', {
        sessionId: 'session-abc',
        userRole: 'admin',
        groups: ['inventory'],
        conversationHistory: [],
      });
    });

    it('should record successful turns in session history', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });
      jest
        .spyOn(ai, 'run')
        .mockResolvedValueOnce(makeResult('First answer'))
        .mockResolvedValueOnce(makeResult('Second answer'));

      const session = ai.createSession('history-session');

      await session.run('First question');
      await session.run('Second question');

      expect(session.turns).toBe(2);
      expect(session.getHistory()).toEqual([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
        { role: 'assistant', content: 'Second answer' },
      ]);
    });

    it('should not record failed turns', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });
      jest.spyOn(ai, 'run').mockRejectedValue(new Error('provider failed'));

      const session = ai.createSession('failed-session');

      await expect(session.run('Will fail')).rejects.toThrow('provider failed');
      expect(session.turns).toBe(0);
      expect(session.getHistory()).toEqual([]);
    });
  });

  describe('History Management', () => {
    it('should return a defensive copy of history', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });
      jest.spyOn(ai, 'run').mockResolvedValue(makeResult('Answer'));

      const session = ai.createSession('copy-session');
      await session.run('Question');

      const history = session.getHistory();
      history.push({ role: 'user', content: 'Injected' });

      expect(session.getHistory()).toHaveLength(2);
      expect(session.turns).toBe(1);
    });

    it('should clear history without changing the session ID', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });
      jest.spyOn(ai, 'run').mockResolvedValue(makeResult('Answer'));

      const session = ai.createSession('clear-session');
      await session.run('Question');

      session.clearHistory();

      expect(session.sessionId).toBe('clear-session');
      expect(session.turns).toBe(0);
      expect(session.getHistory()).toEqual([]);
    });

    it('should prune old messages when maxTurns is exceeded', async () => {
      const ai = new AILink({
        platformKey: 'test-key',
        provider: 'gemini',
        providerKey: 'key',
      });
      jest
        .spyOn(ai, 'run')
        .mockResolvedValueOnce(makeResult('Answer 1'))
        .mockResolvedValueOnce(makeResult('Answer 2'))
        .mockResolvedValueOnce(makeResult('Answer 3'));

      const session = ai.createSession('prune-session', 2);

      await session.run('Question 1');
      await session.run('Question 2');
      await session.run('Question 3');

      expect(session.turns).toBe(2);
      expect(session.getHistory()).toEqual([
        { role: 'user', content: 'Question 2' },
        { role: 'assistant', content: 'Answer 2' },
        { role: 'user', content: 'Question 3' },
        { role: 'assistant', content: 'Answer 3' },
      ]);
    });
  });
});
