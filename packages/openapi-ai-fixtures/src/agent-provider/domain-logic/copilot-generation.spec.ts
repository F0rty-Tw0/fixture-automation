import { writeFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copilotFixture } from './copilot-generation.ts';
import type { AgentCommand } from '../../agent-process/common/agent-process.type.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { agentArgs, agentCommand, fileRequest, modelRequest, stagedContent } from '../../test/utils/agent-model.spec.util.ts';
import { processFixture } from '../../test/utils/process-fixture.spec.util.ts';
import { processWorkspace } from '../../test/utils/process-workspace.spec.util.ts';

type AgentProcessModule = {
  readonly runAgent: (command: AgentCommand, options: AiFixtureOptions) => Promise<string>;
};

vi.mock('../../agent-process/data-access/agent-process.client.ts', async (importOriginal): Promise<AgentProcessModule> => {
  const actual = await importOriginal<AgentProcessModule>();
  const mocked: AgentProcessModule = { runAgent: vi.fn(actual.runAgent) };

  return mocked;
});

const COPILOT = processFixture('process-child', 'copilot-stream.mjs');
const hasModelFlag = (argument: string): boolean => argument.startsWith('--model');

describe('FEATURE: Copilot fixture streaming', (): void => {
  afterEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN a provider that waits for its first response chunk to reach the caller', (): void => {
    it('WHEN requesting a fixture THEN streams before exit and returns only the complete response', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const releaseFile = workspace.file('release');
      const chunks: string[] = [];
      const onProgress = (event: AiFixtureProgress): void => {
        if (event.stream !== 'stdout') return;

        chunks.push(event.text);
        writeFileSync(releaseFile, 'continue');
      };
      const options: AiFixtureOptions = { tool: 'copilot', executable: COPILOT, timeoutMs: 5_000, onProgress };

      try {
        const fixture = await copilotFixture({ prompt: releaseFile, options });
        const streamed = chunks.join('');

        expect(fixture).toBe('{"id":"café"}');
        expect(streamed).toBe(fixture);
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN a selected Copilot model', (): void => {
    it('WHEN the fixture is requested THEN appends the joined --model argument', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue('{}');

      await copilotFixture(modelRequest('copilot', 'gpt-5'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).at(-1)).toBe('--model=gpt-5');
    });

    it('WHEN the model is omitted THEN appends no model flag', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue('{}');

      await copilotFixture(modelRequest('copilot'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).some(hasModelFlag)).toBe(false);
    });
  });

  describe('GIVEN a request that stages files', (): void => {
    beforeEach((): void => {
      vi.mocked(runAgent).mockResolvedValue('{}');
    });

    it('WHEN the fixture is requested THEN stages the files after the agent profile and settings', async (): Promise<void> => {
      await copilotFixture(fileRequest('copilot'));

      const files = agentCommand(vi.mocked(runAgent).mock.calls).files ?? [];
      const stagedPaths = files.map((file): string => file.path);

      expect(stagedPaths).toStrictEqual([
        '.github/agents/fixture-enricher.agent.md',
        '.github/copilot/settings.json',
        'baseline.json'
      ]);
    });

    it('WHEN the fixture is requested THEN the profile allows only reading and searching', async (): Promise<void> => {
      await copilotFixture(fileRequest('copilot'));

      const profile = stagedContent(agentCommand(vi.mocked(runAgent).mock.calls), '.github/agents/fixture-enricher.agent.md');

      expect(profile).toContain('tools: [read, search]');
      expect(profile).toContain('Read and search only the files listed under `files` in the request');
    });

    it('WHEN the fixture is requested THEN read is no longer denied', async (): Promise<void> => {
      await copilotFixture(fileRequest('copilot'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).toContain('--deny-tool=shell,write,url,memory');
    });

    it('WHEN the fixture is requested THEN only the view, grep and glob tools are available', async (): Promise<void> => {
      await copilotFixture(fileRequest('copilot'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).toContain('--available-tools=view,grep,glob');
    });

    it('WHEN the fixture is requested THEN the automatic temp directory access is off', async (): Promise<void> => {
      await copilotFixture(fileRequest('copilot'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).toContain('--disallow-temp-dir');
    });
  });

  describe('GIVEN a request without files', (): void => {
    beforeEach((): void => {
      vi.mocked(runAgent).mockResolvedValue('{}');
    });

    it('WHEN the fixture is requested THEN the profile allows no tools', async (): Promise<void> => {
      await copilotFixture(modelRequest('copilot'));

      const profile = stagedContent(agentCommand(vi.mocked(runAgent).mock.calls), '.github/agents/fixture-enricher.agent.md');

      expect(profile).toContain('tools: []');
    });

    it('WHEN the fixture is requested THEN read stays denied', async (): Promise<void> => {
      await copilotFixture(modelRequest('copilot'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).toContain('--deny-tool=shell,write,read,url,memory');
    });

    it('WHEN the fixture is requested THEN the arguments carry no file-mode flags', async (): Promise<void> => {
      await copilotFixture(modelRequest('copilot'));

      const args = agentArgs(vi.mocked(runAgent).mock.calls);

      expect(args).not.toContain('--available-tools=view,grep,glob');
      expect(args).not.toContain('--disallow-temp-dir');
    });
  });
});
