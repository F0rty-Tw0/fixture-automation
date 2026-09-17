import { access } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { AI_FIXTURE_OPTIONS_STUB } from '../test/stubs/ai-fixture-options.stub.ts';
import { childCommand } from '../test/utils/process-child.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

describe('FEATURE: agent process lifecycle', (): void => {
  describe('GIVEN an in-flight child and an AbortSignal', (): void => {
    it('WHEN the signal is aborted THEN terminates the child before scratch cleanup', async (): Promise<void> => {
      const controller = new AbortController();
      const workspace = await processWorkspace();
      const cwdMarker = workspace.file('child-cwd.txt');
      const options: AiFixtureOptions = {
        tool: 'claude',
        timeoutMs: 5_000,
        signal: controller.signal
      };
      const execution = runAgent(childCommand('wait', [cwdMarker]), options);

      try {
        const cwd = await workspace.waitForFile('child-cwd.txt');

        controller.abort(new Error('test cancellation'));

        await expect(execution).rejects.toThrow(/test cancellation/);
        await expect(access(cwd)).rejects.toThrow();
      } finally {
        await workspace.dispose();
      }
    });

    it('WHEN the signal is aborted without an Error reason THEN rejects with the generic cancellation', async (): Promise<void> => {
      const controller = new AbortController();
      const workspace = await processWorkspace();
      const cwdMarker = workspace.file('child-cwd.txt');
      const options: AiFixtureOptions = { ...AI_FIXTURE_OPTIONS_STUB, signal: controller.signal };
      const execution = runAgent(childCommand('wait', [cwdMarker]), options);

      try {
        await workspace.waitForFile('child-cwd.txt');

        controller.abort('operator request');

        await expect(execution).rejects.toThrow('Agent execution was canceled');
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN a signal aborted while the child is being prepared', (): void => {
    it('WHEN the child spawns THEN stops it immediately with the abort reason', async (): Promise<void> => {
      const controller = new AbortController();
      const options: AiFixtureOptions = { ...AI_FIXTURE_OPTIONS_STUB, signal: controller.signal };
      const execution = runAgent(childCommand('wait', []), options);

      controller.abort(new Error('early cancellation'));

      await expect(execution).rejects.toThrow('early cancellation');
    });
  });

  describe('GIVEN a child that exceeds a short timeout', (): void => {
    it('WHEN it runs beyond the limit THEN terminates the child before scratch cleanup', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const cwdMarker = workspace.file('child-cwd.txt');
      const onProgress = (event: AiFixtureProgress): void => {
        const mentionsExit = event.text.includes('ended');
        const isProcessEnded = event.stream === 'status' && mentionsExit;

        if (isProcessEnded) throw new Error('progress listener failure');
      };
      const options: AiFixtureOptions = { tool: 'claude', timeoutMs: 500, onProgress };
      const execution = runAgent(childCommand('wait', [cwdMarker]), options);

      try {
        const cwd = await workspace.waitForFile('child-cwd.txt');

        await expect(execution).rejects.toThrow(/timed out/);
        await expect(access(cwd)).rejects.toThrow();
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN a progress listener that fails on the start status', (): void => {
    it('WHEN the child starts THEN rejects with the listener error', async (): Promise<void> => {
      const failure = new Error('start reporter failure');
      const onProgress = (event: AiFixtureProgress): void => {
        const isStart = event.text.startsWith('Started');

        if (isStart) throw failure;
      };
      const options: AiFixtureOptions = { ...AI_FIXTURE_OPTIONS_STUB, onProgress };

      const execution = runAgent(childCommand('wait', []), options);

      await expect(execution).rejects.toBe(failure);
    });
  });

  describe('GIVEN a listener that fails after the child has exited', (): void => {
    it('WHEN reporting completion THEN rejects with the listener error and removes the workspace', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const marker = workspace.file('child-cwd.txt');
      const command = childCommand('write-cwd', [marker]);
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

  describe('GIVEN a progress listener and a quiet successful child', (): void => {
    it('WHEN the child ends THEN reports the start and end status around its output', async (): Promise<void> => {
      const streams: string[] = [];
      const onProgress = (event: AiFixtureProgress): void => {
        streams.push(event.stream);
      };
      const options: AiFixtureOptions = { ...AI_FIXTURE_OPTIONS_STUB, onProgress };

      const output = await runAgent(childCommand('stream', []), options);

      expect(output).toBe('firstcomplete');
      expect(streams.at(0)).toBe('status');
      expect(streams.at(-1)).toBe('status');
    });
  });

  describe('GIVEN an unavailable executable', (): void => {
    it('WHEN running THEN reports an actionable startup error', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const executable = workspace.file('not-installed.exe');
      const command: AgentCommand = { executable, args: [], input: '' };

      try {
        await expect(runAgent(command, AI_FIXTURE_OPTIONS_STUB)).rejects.toThrow(/Failed to start agent/);
      } finally {
        await workspace.dispose();
      }
    });
  });
});
