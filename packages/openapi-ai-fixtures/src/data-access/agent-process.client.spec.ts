import { access, readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';
import { AI_FIXTURE_OPTIONS_STUB } from '../test/stubs/ai-fixture-options.stub.ts';
import { childCommand } from '../test/utils/process-child.spec.util.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const ONE_MEBIBYTE = 1024 * 1024;

describe('FEATURE: agent process execution', (): void => {
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

        const output = await runAgent(command, AI_FIXTURE_OPTIONS_STUB);
        const result: unknown = JSON.parse(output);

        await runAgent(childCommand('write-cwd', [marker]), AI_FIXTURE_OPTIONS_STUB);

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

      await expect(runAgent(childCommand('echo', [], input), AI_FIXTURE_OPTIONS_STUB)).rejects.toThrow(
        /input exceeds the 1 MiB limit/
      );
    });
  });
  describe('GIVEN an unsupported timer duration', (): void => {
    it('WHEN running THEN rejects before creating a child process', async (): Promise<void> => {
      const options: AiFixtureOptions = { tool: 'claude', timeoutMs: 2_147_483_648 };

      await expect(runAgent(childCommand('echo', []), options)).rejects.toThrow(/positive integer no greater than 2147483647/);
    });
  });

  describe('GIVEN an already-aborted signal', (): void => {
    it('WHEN aborted with an Error THEN rejects with that error before creating a child process', async (): Promise<void> => {
      const reason = new Error('canceled before start');
      const options: AiFixtureOptions = { ...AI_FIXTURE_OPTIONS_STUB, signal: AbortSignal.abort(reason) };

      await expect(runAgent(childCommand('echo', []), options)).rejects.toBe(reason);
    });

    it('WHEN aborted without an Error THEN rejects with the generic cancellation', async (): Promise<void> => {
      const options: AiFixtureOptions = { ...AI_FIXTURE_OPTIONS_STUB, signal: AbortSignal.abort('operator request') };

      await expect(runAgent(childCommand('echo', []), options)).rejects.toThrow('Agent execution was canceled');
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
