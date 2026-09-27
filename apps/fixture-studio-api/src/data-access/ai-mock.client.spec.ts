import type { AiFixtureProgress, AiMissingRequest } from '@fixture-automation/openapi-ai-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { MOCK_AI } from './ai-mock.client.ts';
import { missingFixture } from '../test/utils/studio-spec.spec.util.ts';

const isStdout = (entry: AiFixtureProgress): boolean => entry.stream === 'stdout';

describe('FEATURE: mock AI', (): void => {
  let request: AiMissingRequest;

  beforeAll(async (): Promise<void> => {
    const missing = await missingFixture('status');

    request = { fixture: {}, missing, scenario: 'any' };
  });

  describe('GIVEN a mock fill', (): void => {
    it('WHEN run THEN reports canned progress and returns the sampled missing values', async (): Promise<void> => {
      const progress: AiFixtureProgress[] = [];
      const onProgress = (entry: AiFixtureProgress): void => {
        progress.push(entry);
      };

      const populated = await MOCK_AI.fill({ tool: 'codex', onProgress })('invoice', request);

      expect(populated).toStrictEqual({ status: 'open' });
      expect(progress).toHaveLength(3);
      expect(progress.every(isStdout)).toBe(true);
    });

    it('WHEN its signal is already aborted THEN rejects without a result', async (): Promise<void> => {
      const controller = new AbortController();

      controller.abort(new Error('stop'));

      const fill = MOCK_AI.fill({ tool: 'codex', signal: controller.signal })('invoice', request);

      await expect(fill).rejects.toThrow('stop');
    });
  });

  describe('GIVEN a mock discovery', (): void => {
    it('WHEN asked for a tool THEN offers mock-model from that tool', async (): Promise<void> => {
      const discovery = await MOCK_AI.discover('gemini', {});

      expect(discovery).toStrictEqual({ models: ['mock-model'], source: 'gemini-cli' });
    });
  });

  describe('GIVEN a mock install check', (): void => {
    it('WHEN run THEN reports every tool installed, so any tool can be picked', async (): Promise<void> => {
      const installs = await MOCK_AI.detect();

      const installed = installs.map((install) => install.installed);
      const tools = installs.map((install) => install.tool);

      expect(tools).toStrictEqual(['claude', 'codex', 'antigravity', 'copilot', 'gemini']);
      expect(installed).toStrictEqual([true, true, true, true, true]);
    });

    it('WHEN read THEN flags itself as a mock', (): void => {
      expect(MOCK_AI.isMock).toBe(true);
    });
  });
});
