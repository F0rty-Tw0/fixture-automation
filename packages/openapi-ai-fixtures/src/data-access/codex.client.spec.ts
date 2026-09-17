import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { codexFixture } from './codex.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';
import { agentArgs, modelRequest } from '../test/utils/agent-model.spec.util.ts';

vi.mock('./agent-process.client.ts');

const options = { tool: 'codex' } as const;
const request: AgentRequest = { prompt: 'Return a fixture.', options };
const agentMessage = { type: 'agent_message', text: '{}' };
const completedItem = { type: 'item.completed', item: agentMessage };
const completedTurn = { type: 'turn.completed' };
const codexLines = [JSON.stringify(completedItem), JSON.stringify(completedTurn)];
const codexEvents = codexLines.join('\n');

describe('FEATURE: Codex fixture response handling', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN Codex reports a failed turn in its zero-exit event stream', (): void => {
    it('WHEN the fixture is requested THEN rejects the reported error', async (): Promise<void> => {
      const error = { message: 'Authentication failed.' };
      const response = JSON.stringify({
        type: 'turn.failed',
        error
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = codexFixture(request);

      await expect(fixture).rejects.toThrow('Authentication failed.');
    });
  });

  describe('GIVEN Codex completes a turn with malformed fixture text', (): void => {
    it('WHEN the fixture is requested THEN returns the exact response for central parsing', async (): Promise<void> => {
      const text = '{not-json}';
      const message = { type: 'agent_message', text };
      const events = [JSON.stringify({ type: 'item.completed', item: message }), JSON.stringify({ type: 'turn.completed' })];
      const response = events.join('\n');

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await codexFixture(request);

      expect(fixture).toBe(text);
    });
  });

  describe('GIVEN Codex completes a turn with a fixture message', (): void => {
    it('WHEN the fixture is requested THEN returns the exact fixture text', async (): Promise<void> => {
      const expected = { id: 'invoice-1', amount: 42 };
      const text = JSON.stringify(expected);
      const message = { type: 'agent_message', text };
      const events = [JSON.stringify({ type: 'item.completed', item: message }), JSON.stringify({ type: 'turn.completed' })];
      const response = events.join('\n');

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await codexFixture(request);

      expect(fixture).toBe(text);
    });
  });

  describe('GIVEN a selected Codex model', (): void => {
    it('WHEN the fixture is requested THEN sends -m ahead of the trailing stdin placeholder', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(codexEvents);

      await codexFixture(modelRequest('codex', 'gpt-5.5'));

      const args = agentArgs(vi.mocked(runAgent).mock.calls);
      const flag = args.indexOf('-m');

      expect(flag).toBeGreaterThan(-1);
      expect(flag).toBeLessThan(args.indexOf('-'));
      expect(args[flag + 1]).toBe('gpt-5.5');
      expect(args.at(-1)).toBe('-');
    });
  });

  describe('GIVEN no selected Codex model', (): void => {
    it('WHEN the model is omitted THEN sends the unchanged argument vector', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(codexEvents);

      await codexFixture(modelRequest('codex'));

      const args = agentArgs(vi.mocked(runAgent).mock.calls);

      expect(args).not.toContain('-m');
      expect(args.at(-1)).toBe('-');
    });

    it('WHEN the harness default is selected THEN sends the unchanged argument vector', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(codexEvents);

      await codexFixture(modelRequest('codex', 'default'));

      const args = agentArgs(vi.mocked(runAgent).mock.calls);

      expect(args).not.toContain('-m');
      expect(args.at(-1)).toBe('-');
    });
  });
});
