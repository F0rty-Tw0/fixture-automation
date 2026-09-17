import { writeFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { copilotFixture } from './copilot.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { agentArgs, modelRequest } from '../test/utils/agent-model.spec.util.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

type AgentProcessModule = {
  readonly runAgent: (command: AgentCommand, options: AiFixtureOptions) => Promise<string>;
};

vi.mock('./agent-process.client.ts', async (importOriginal): Promise<AgentProcessModule> => {
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
});
