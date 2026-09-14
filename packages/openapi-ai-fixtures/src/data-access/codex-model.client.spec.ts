import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { codexFixture } from './codex.client.ts';
import { agentArgs, modelRequest } from '../test/utils/agent-model.spec.util.ts';

vi.mock('./agent-process.client.ts');

const agentMessage = { type: 'agent_message', text: '{}' };
const completedItem = { type: 'item.completed', item: agentMessage };
const completedTurn = { type: 'turn.completed' };
const codexLines = [JSON.stringify(completedItem), JSON.stringify(completedTurn)];
const codexEvents = codexLines.join('\n');

describe('FEATURE: Codex model passthrough', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
    vi.mocked(runAgent).mockResolvedValue(codexEvents);
  });

  describe('GIVEN a selected Codex model', (): void => {
    it('WHEN the fixture is requested THEN sends -m ahead of the trailing stdin placeholder', async (): Promise<void> => {
      await codexFixture(modelRequest('codex', 'gpt-5.5'));

      const args = agentArgs();
      const flag = args.indexOf('-m');

      expect(flag).toBeGreaterThan(-1);
      expect(flag).toBeLessThan(args.indexOf('-'));
      expect(args[flag + 1]).toBe('gpt-5.5');
      expect(args.at(-1)).toBe('-');
    });
  });

  describe('GIVEN no selected Codex model', (): void => {
    it('WHEN the model is omitted THEN sends the unchanged argument vector', async (): Promise<void> => {
      await codexFixture(modelRequest('codex'));

      const args = agentArgs();

      expect(args).not.toContain('-m');
      expect(args.at(-1)).toBe('-');
    });

    it('WHEN the harness default is selected THEN sends the unchanged argument vector', async (): Promise<void> => {
      await codexFixture(modelRequest('codex', 'default'));

      const args = agentArgs();

      expect(args).not.toContain('-m');
      expect(args.at(-1)).toBe('-');
    });
  });
});
