import { access, readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const PROCESS_OPTIONS: AiFixtureOptions = { tool: 'claude', timeoutMs: 5_000 };
const PROCESS_CHILD = processFixture('process-child', 'process-child.mjs');
const ONE_MEBIBYTE = 1024 * 1024;

const childCommand = (mode: string, args: string[], input = ''): AgentCommand => {
  const command: AgentCommand = {
    executable: process.execPath,
    args: [PROCESS_CHILD, mode, ...args],
    input
  };

  return command;
};

describe('FEATURE: agent process execution', (): void => {
  describe('GIVEN a provider that requires a response before listing models', (): void => {
    it('WHEN exchanging split lines THEN waits for the catalog before closing stdin', async (): Promise<void> => {
      const executable = processFixture('process-child', 'conversation.mjs');
      const respond = (line: string): string | null | undefined => {
        if (line === 'ready') return 'models\n';

        if (line === 'model-from-provider') return null;

        return undefined;
      };
      const command: AgentCommand = { executable: process.execPath, args: [executable], input: 'initialize\n', respond };

      const output = await runAgent(command, PROCESS_OPTIONS);

      expect(output).toBe('ready\nnotification\nmodel-from-provider\n');
    });
  });

  describe('GIVEN a child that reads stdin, arguments, a staged file, and environment', (): void => {
    it('WHEN running THEN returns exact stdout from an isolated working directory', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const marker = workspace.file('child-cwd.txt');
      const stagedFiles = [{ path: 'nested/context.json', content: '{"source":"staged"}' }];
      const baseCommand = childCommand('echo', ['--literal; touch nope', '$(echo nope)'], 'line one\nline two');
      const environment: Record<string, string | undefined> = {};

      environment['PROCESS_FIXTURE_REMOVED'] = undefined;
      environment['PROCESS_FIXTURE_VALUE'] = 'present';

      const command: AgentCommand = {
        ...baseCommand,
        env: environment,
        files: stagedFiles
      };

      try {
        vi.stubEnv('PROCESS_FIXTURE_REMOVED', 'inherited');

        const output = await runAgent(command, PROCESS_OPTIONS);
        const result: unknown = JSON.parse(output);

        await runAgent(childCommand('write-cwd', [marker]), PROCESS_OPTIONS);

        expect(result).toStrictEqual({
          args: ['--literal; touch nope', '$(echo nope)'],
          envValue: 'present',
          file: '{"source":"staged"}',
          hasRemovedValue: false,
          input: 'line one\nline two'
        });

        const cwd = await readFile(marker, 'utf8');

        await expect(access(cwd)).rejects.toThrow();
      } finally {
        vi.unstubAllEnvs();
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN an oversized agent input', (): void => {
    it('WHEN running THEN rejects before spawning a child process', async (): Promise<void> => {
      const input = 'x'.repeat(ONE_MEBIBYTE + 1);

      await expect(runAgent(childCommand('echo', [], input), PROCESS_OPTIONS)).rejects.toThrow(/input exceeds the 1 MiB limit/);
    });
  });
  describe('GIVEN an unsupported timer duration', (): void => {
    it('WHEN running THEN rejects before creating a child process', async (): Promise<void> => {
      const options: AiFixtureOptions = { tool: 'claude', timeoutMs: 2_147_483_648 };

      await expect(runAgent(childCommand('echo', []), options)).rejects.toThrow(/positive integer no greater than 2147483647/);
    });
  });

  describe('GIVEN a child that exceeds the combined output limit', (): void => {
    it('WHEN running THEN rejects instead of truncating its output', async (): Promise<void> => {
      await expect(runAgent(childCommand('overflow', []), PROCESS_OPTIONS)).rejects.toThrow(/output exceeds the 8 MiB limit/);
    });
  });
  describe('GIVEN a child that writes output before it exits', (): void => {
    it('WHEN progress is observed THEN delivers decoded streams before settlement', async (): Promise<void> => {
      const { promise: outputObserved, resolve: resolveOutputObserved } = Promise.withResolvers<undefined>();
      const progress: AiFixtureProgress[] = [];
      let isComplete = false;
      const onProgress = (event: AiFixtureProgress): void => {
        progress.push(event);

        const containsFirstOutput = event.text.includes('first');
        const isFirstStdout = event.stream === 'stdout' && containsFirstOutput;

        if (isFirstStdout) resolveOutputObserved(undefined);
      };
      const options: AiFixtureOptions = { tool: 'claude', onProgress };
      const execution = runAgent(childCommand('stream', []), options).finally((): void => {
        isComplete = true;
      });

      await outputObserved;

      expect(isComplete).toBe(false);

      const output = await execution;

      expect(output).toBe('firstcomplete');
      expect(progress).toContainEqual({ stream: 'stderr', text: 'warning' });
    });
  });
  describe('GIVEN a child that splits a UTF-8 code point across writes', (): void => {
    it('WHEN progress is observed THEN delivers the original decoded text', async (): Promise<void> => {
      const progress: AiFixtureProgress[] = [];
      const onProgress = (event: AiFixtureProgress): void => {
        progress.push(event);
      };
      const options: AiFixtureOptions = { ...PROCESS_OPTIONS, onProgress };

      const output = await runAgent(childCommand('split-utf8', []), options);
      const stdoutEvents = progress.filter((event): boolean => event.stream === 'stdout');
      const stdout = stdoutEvents.map((event): string => event.text).join('');

      expect(output).toBe('{"name":"é"}');
      expect(stdout).toBe('{"name":"é"}');
    });
  });

  describe('GIVEN a child that exits unsuccessfully', (): void => {
    it('WHEN running THEN reports its exit code and stderr after scratch cleanup', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const marker = workspace.file('child-cwd.txt');

      try {
        await expect(runAgent(childCommand('nonzero', [marker]), PROCESS_OPTIONS)).rejects.toThrow(
          /exited with code 23.*fixture child failed/
        );

        const cwd = await readFile(marker, 'utf8');

        await expect(access(cwd)).rejects.toThrow();
      } finally {
        await workspace.dispose();
      }
    });
  });

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

  describe('GIVEN an unsafe staged file path', (): void => {
    it('WHEN running THEN rejects traversal outside the scratch directory', async (): Promise<void> => {
      const files = [{ path: '../outside.json', content: 'outside' }];
      const baseCommand = childCommand('echo', []);
      const command: AgentCommand = { ...baseCommand, files };

      await expect(runAgent(command, PROCESS_OPTIONS)).rejects.toThrow(/must be relative and stay within the agent scratch directory/);
    });
  });

  describe('GIVEN an unavailable executable', (): void => {
    it('WHEN running THEN reports an actionable startup error', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const executable = workspace.file('not-installed.exe');
      const command: AgentCommand = { executable, args: [], input: '' };

      try {
        await expect(runAgent(command, PROCESS_OPTIONS)).rejects.toThrow(/Failed to start agent/);
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe.each(['npm-style-agent.cmd', 'nested/pnpm-style-agent.cmd'])('GIVEN the Windows Node shim %s', (shim): void => {
    it.runIf(process.platform === 'win32')(
      'WHEN running THEN executes its Node entry point without a shell',
      async (): Promise<void> => {
        const executable = processFixture('executable-node-shim', shim);
        const command: AgentCommand = {
          executable: 'fixture-agent',
          args: ['--from-shim'],
          input: 'shim input'
        };
        const options: AiFixtureOptions = {
          tool: 'claude',
          executable,
          timeoutMs: 5_000
        };

        const output = await runAgent(command, options);
        const result: unknown = JSON.parse(output);

        expect(result).toStrictEqual({ args: ['--from-shim'], input: 'shim input' });
      }
    );
  });
  describe('GIVEN a Node.js entry point override', (): void => {
    it('WHEN running THEN starts it through the current Node executable', async (): Promise<void> => {
      const entryPoint = processFixture('executable-node-shim', 'fixture-agent.mjs');
      const command: AgentCommand = {
        executable: 'fixture-agent',
        args: ['--unchanged'],
        input: 'fixture input'
      };
      const options: AiFixtureOptions = {
        tool: 'claude',
        executable: entryPoint,
        timeoutMs: 5_000
      };

      const output = await runAgent(command, options);
      const result: unknown = JSON.parse(output);

      expect(result).toStrictEqual({
        args: ['--unchanged'],
        input: 'fixture input'
      });
    });
  });
});
