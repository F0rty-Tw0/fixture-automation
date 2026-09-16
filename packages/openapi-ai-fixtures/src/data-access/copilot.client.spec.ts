import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { copilotFixture } from './copilot.client.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const COPILOT = processFixture('process-child', 'copilot-stream.mjs');

describe('FEATURE: Copilot fixture streaming', (): void => {
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
});
