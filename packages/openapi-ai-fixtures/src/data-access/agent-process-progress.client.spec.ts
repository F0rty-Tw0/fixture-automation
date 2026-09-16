import { access } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const PROCESS_CHILD = processFixture('process-child', 'process-child.mjs');

describe('FEATURE: agent process progress failures', (): void => {
  describe('GIVEN a progress listener that fails on child output', (): void => {
    it('WHEN the child writes its working directory THEN rejects and cleans the scratch directory', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const marker = workspace.file('child-cwd.txt');
      const command: AgentCommand = {
        executable: process.execPath,
        args: [PROCESS_CHILD, 'progress-wait', marker],
        input: ''
      };
      const onProgress = (event: AiFixtureProgress): void => {
        if (event.stream === 'stdout') throw new Error('progress listener failure');
      };
      const options: AiFixtureOptions = { tool: 'claude', onProgress };
      const execution = runAgent(command, options);

      try {
        const cwd = await workspace.waitForFile('child-cwd.txt');

        await expect(execution).rejects.toThrow(/progress listener failure/);
        await expect(access(cwd)).rejects.toThrow();
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN a listener that fails after the child has exited', (): void => {
    it('WHEN reporting completion THEN rejects with the listener error and removes the workspace', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const marker = workspace.file('child-cwd.txt');
      const command: AgentCommand = { executable: process.execPath, args: [PROCESS_CHILD, 'write-cwd', marker], input: '' };
      const failure = new Error('completion reporter failure');
      let sawOutput = false;
      const onProgress = (event: AiFixtureProgress): void => {
        if (!sawOutput) {
          sawOutput = event.stream === 'stdout';

          return;
        }

        if (event.stream === 'status') throw failure;
      };
      const options: AiFixtureOptions = { tool: 'claude', timeoutMs: 5_000, onProgress };
      const execution = runAgent(command, options);

      try {
        await expect(execution).rejects.toBe(failure);

        const cwd = await workspace.waitForFile('child-cwd.txt');

        await expect(access(cwd)).rejects.toThrow();
      } finally {
        await workspace.dispose();
      }
    });
  });
});
