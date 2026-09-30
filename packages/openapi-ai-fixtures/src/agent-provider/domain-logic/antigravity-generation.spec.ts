import assert from 'node:assert/strict';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { antigravityFixture } from './antigravity-generation.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import { agentArgs, agentCommand, fileRequest, modelRequest, stagedContent } from '../../test/utils/agent-model.spec.util.ts';
import { agentResponse } from '../../test/utils/agent-response.spec.util.ts';

vi.mock('../../agent-process/data-access/agent-process.client.ts');

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

  describe('GIVEN a request that stages files', (): void => {
    it('WHEN the fixture is requested THEN stages the files after the agent profile', async (): Promise<void> => {
      await antigravityFixture(fileRequest('antigravity'));

      const files = agentCommand(vi.mocked(runAgent).mock.calls).files ?? [];
      const stagedPaths = files.map((file): string => file.path);

      expect(stagedPaths).toStrictEqual(['.agents/agents/fixture-enricher/agent.md', 'baseline.json']);
    });

    it('WHEN the fixture is requested THEN the profile allows only read-only tools', async (): Promise<void> => {
      await antigravityFixture(fileRequest('antigravity'));

      const profile = stagedContent(agentCommand(vi.mocked(runAgent).mock.calls), '.agents/agents/fixture-enricher/agent.md');

      expect(profile).toContain('tools: [view_file, list_dir, grep_search, find_by_name]');
      expect(profile).toContain('Read and search only the files listed under `files` in the request');
    });
  });

  describe('GIVEN a request without files', (): void => {
    it('WHEN the fixture is requested THEN the profile allows no tools', async (): Promise<void> => {
      await antigravityFixture(modelRequest('antigravity'));

      const profile = stagedContent(agentCommand(vi.mocked(runAgent).mock.calls), '.agents/agents/fixture-enricher/agent.md');

      expect(profile).toContain('tools: []');
      expect(profile).toContain('Do not read, write, inspect, execute, browse, delegate, or invoke tools.');
    });
  });
});
