import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { claudeFixture } from './claude.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';
import { agentArgs, modelRequest } from '../test/utils/agent-model.spec.util.ts';

vi.mock('./agent-process.client.ts');

const options = { tool: 'claude' } as const;
const request: AgentRequest = { prompt: 'Return a fixture.', options };
const claudeResult = { type: 'result', subtype: 'success', is_error: false, result: '{}' };
const claudeEnvelope = JSON.stringify(claudeResult);

describe('FEATURE: Claude fixture response handling', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN Claude reports an error in a zero-exit result envelope', (): void => {
    it('WHEN the fixture is requested THEN rejects the reported error', async (): Promise<void> => {
      const response = JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'Authentication failed.'
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = claudeFixture(request);

      await expect(fixture).rejects.toThrow('Authentication failed.');
    });
  });

  describe('GIVEN Claude reports success with malformed fixture text', (): void => {
    it('WHEN the fixture is requested THEN returns the exact response for central parsing', async (): Promise<void> => {
      const response = JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: '{not-json}'
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await claudeFixture(request);

      expect(fixture).toBe('{not-json}');
    });
  });

  describe('GIVEN Claude reports success with fixture JSON', (): void => {
    it('WHEN the fixture is requested THEN returns the exact fixture text', async (): Promise<void> => {
      const expected = { id: 'invoice-1', amount: 42 };
      const result = JSON.stringify(expected);
      const response = JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await claudeFixture(request);

      expect(fixture).toBe(result);
    });
  });

  describe('GIVEN a selected Claude model', (): void => {
    it('WHEN the fixture is requested THEN appends --model and the slug', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(claudeEnvelope);

      await claudeFixture(modelRequest('claude', 'opus'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).slice(-2)).toStrictEqual(['--model', 'opus']);
    });

    it('WHEN the harness default is selected THEN appends no model flag', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(claudeEnvelope);

      await claudeFixture(modelRequest('claude', 'default'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).not.toContain('--model');
    });
  });
});
