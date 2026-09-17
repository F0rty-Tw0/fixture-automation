import assert from 'node:assert/strict';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { antigravityFixture } from './antigravity.client.ts';
import { agentArgs, modelRequest } from '../test/utils/agent-model.spec.util.ts';
import { agentResponse } from '../test/utils/agent-response.spec.util.ts';

vi.mock('./agent-process.client.ts');

const antigravityEnvelope = agentResponse('antigravity', '{"status":"open"}');

describe('FEATURE: Antigravity fixture requests', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
    vi.mocked(runAgent).mockResolvedValue(antigravityEnvelope);
  });

  describe('GIVEN a successful result event', (): void => {
    it('WHEN the fixture is requested THEN returns the response text', async (): Promise<void> => {
      const fixture = await antigravityFixture(modelRequest('antigravity'));

      expect(fixture).toBe('{"status":"open"}');
    });

    it('WHEN the fixture is requested THEN sends the prompt as a user event to a tool-less sandboxed agent', async (): Promise<void> => {
      await antigravityFixture(modelRequest('antigravity'));

      const [call] = vi.mocked(runAgent).mock.calls;
      const args = agentArgs(vi.mocked(runAgent).mock.calls);

      assert(call !== undefined);

      const [command, options] = call;
      const stagedPaths = command.files?.map((file): string => file.path);

      expect(command.executable).toBe('agy');
      expect(args).toStrictEqual([
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        '--agent',
        'fixture-enricher',
        '--sandbox'
      ]);
      expect(command.input).toBe('{"event":"user","message":{"content":"Return a fixture."}}\n');
      expect(stagedPaths).toStrictEqual(['.agents/agents/fixture-enricher/agent.md']);
      expect(options.tool).toBe('antigravity');
    });
  });

  describe('GIVEN a selected Antigravity model', (): void => {
    it('WHEN the fixture is requested THEN appends --model and the slug', async (): Promise<void> => {
      await antigravityFixture(modelRequest('antigravity', 'agy-pro'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).slice(-2)).toStrictEqual(['--model', 'agy-pro']);
    });

    it('WHEN the harness default is selected THEN appends no model flag', async (): Promise<void> => {
      await antigravityFixture(modelRequest('antigravity', 'default'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).not.toContain('--model');
    });
  });
});
