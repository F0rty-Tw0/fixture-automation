import { execFile } from 'node:child_process';
import { access, rm } from 'node:fs/promises';
import { promisify } from 'node:util';

import { describe, expect, it, vi } from 'vitest';

import { AgentTerminationError } from './agent-process-termination.error.ts';
import { runAgent } from './agent-process.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const PROCESS_CHILD = processFixture('process-child', 'process-child.mjs');
const executeFile = promisify(execFile);

describe('FEATURE: agent process containment failures', (): void => {
  describe('GIVEN an unavailable Windows tree terminator', (): void => {
    it.runIf(process.platform === 'win32')(
      'WHEN aborting a running child THEN reports the failure and retains its workspace',
      async (): Promise<void> => {
        const workspace = await processWorkspace();
        const controller = new AbortController();
        const marker = workspace.file('child-cwd.txt');
        const command: AgentCommand = { executable: process.execPath, args: [PROCESS_CHILD, 'wait', marker], input: '' };
        const options: AiFixtureOptions = { tool: 'claude', timeoutMs: 5_000, signal: controller.signal };
        const execution = runAgent(command, options);
        const outcome = execution.catch((error: unknown): unknown => error);
        let retainedDirectory: string | undefined;

        try {
          retainedDirectory = await workspace.waitForFile('child-cwd.txt');
          vi.stubEnv('SystemRoot', '');
          controller.abort(new Error('test cancellation'));

          const error = await outcome;

          expect(error).toBeInstanceOf(AgentTerminationError);
          await access(retainedDirectory);
        } finally {
          vi.unstubAllEnvs();
          controller.abort();
          await outcome;

          if (retainedDirectory !== undefined) {
            await rm(retainedDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
          }

          await workspace.dispose();
        }
      }
    );
  });

  describe('GIVEN a SIGTERM-resistant descendant and a short-lived host', (): void => {
    it.runIf(process.platform !== 'win32')(
      'WHEN the host times out and exits THEN no descendant continues working',
      async (): Promise<void> => {
        const workspace = await processWorkspace();
        const host = processFixture('process-child', 'process-host.mjs');
        const cwdMarker = workspace.file('child-cwd.txt');
        const grandchildMarker = workspace.file('grandchild.txt');
        const readyMarker = workspace.file('grandchild-ready.txt');
        const execution = executeFile(process.execPath, [host, cwdMarker, grandchildMarker, readyMarker], { timeout: 10_000 });

        try {
          await Promise.all([workspace.waitForFile('grandchild-ready.txt'), execution]);

          const cwd = await workspace.waitForFile('child-cwd.txt');

          await expect(access(cwd)).rejects.toThrow();
          await expect(workspace.waitForFile('grandchild.txt')).rejects.toThrow();
        } finally {
          await Promise.allSettled([execution]);
          await workspace.dispose();
        }
      },
      15_000
    );
  });
});
