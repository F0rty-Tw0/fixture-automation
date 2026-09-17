import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { agentEnvironment, stageAgentFiles } from './agent-process-workspace.client.ts';
import { runAgent } from './agent-process.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import { AI_FIXTURE_OPTIONS_STUB } from '../test/stubs/ai-fixture-options.stub.ts';
import { childCommand } from '../test/utils/process-child.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

const NO_FILES: AgentCommand = { executable: 'agent', args: [], input: '' };
const UNSAFE_PATHS = [
  ['an absolute path', '/etc/passwd'],
  ['a backslash root path', '\\etc\\passwd'],
  ['a drive-prefixed path', 'c:/context.json'],
  ['a colon inside a segment', 'nested/a:b.json'],
  ['a parent segment', '../outside.json'],
  ['a current-directory segment', './context.json'],
  ['an empty segment', 'nested//context.json']
];

const withFiles = (path: string): AgentCommand => {
  const files = [{ path, content: 'staged' }];
  const command: AgentCommand = { ...NO_FILES, files };

  return command;
};

const withEnvironment = (name: string, value: string | undefined): AgentCommand => {
  const env: Record<string, string | undefined> = {};

  env[name] = value;

  const command: AgentCommand = { ...NO_FILES, env };

  return command;
};

describe('FEATURE: agent process workspace', (): void => {
  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  describe('GIVEN a command without files', (): void => {
    it('WHEN staging THEN leaves the scratch directory empty', async (): Promise<void> => {
      const workspace = await processWorkspace();

      try {
        await stageAgentFiles(workspace.directory, NO_FILES);

        await expect(readdir(workspace.directory)).resolves.toStrictEqual([]);
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN a nested relative file', (): void => {
    it('WHEN staging THEN writes it inside the scratch directory', async (): Promise<void> => {
      const workspace = await processWorkspace();

      try {
        await stageAgentFiles(workspace.directory, withFiles('nested/context.json'));

        await expect(readFile(join(workspace.directory, 'nested', 'context.json'), 'utf8')).resolves.toBe('staged');
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN a file path that could leave the scratch directory', (): void => {
    it.each(UNSAFE_PATHS)('WHEN staging %s THEN rejects it before writing', async (_label, path): Promise<void> => {
      const workspace = await processWorkspace();

      try {
        await expect(stageAgentFiles(workspace.directory, withFiles(path))).rejects.toThrow(
          `Agent file path "${path}" must be relative and stay within the agent scratch directory`
        );
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

      await expect(runAgent(command, AI_FIXTURE_OPTIONS_STUB)).rejects.toThrow(
        /must be relative and stay within the agent scratch directory/
      );
    });
  });

  describe('GIVEN a command without environment overrides', (): void => {
    it('WHEN building the environment THEN copies the current process environment', (): void => {
      vi.stubEnv('PROCESS_FIXTURE_VALUE', 'inherited');

      const environment = agentEnvironment(NO_FILES);

      expect(environment).toStrictEqual({ ...process.env });
    });
  });

  describe('GIVEN environment overrides', (): void => {
    it('WHEN a value is given THEN it replaces the inherited value', (): void => {
      vi.stubEnv('PROCESS_FIXTURE_VALUE', 'inherited');

      const environment = agentEnvironment(withEnvironment('PROCESS_FIXTURE_VALUE', 'present'));

      expect(environment['PROCESS_FIXTURE_VALUE']).toBe('present');
    });

    it('WHEN a value is undefined THEN the inherited variable is removed', (): void => {
      vi.stubEnv('PROCESS_FIXTURE_REMOVED', 'inherited');

      const environment = agentEnvironment(withEnvironment('PROCESS_FIXTURE_REMOVED', undefined));

      expect(environment).not.toHaveProperty('PROCESS_FIXTURE_REMOVED');
    });

    it.runIf(process.platform !== 'win32')('WHEN the name differs only by case THEN the inherited variable stays', (): void => {
      vi.stubEnv('PROCESS_FIXTURE_VALUE', 'inherited');

      const environment = agentEnvironment(withEnvironment('process_fixture_value', 'present'));

      expect(environment['PROCESS_FIXTURE_VALUE']).toBe('inherited');
      expect(environment['process_fixture_value']).toBe('present');
    });

    it.runIf(process.platform === 'win32')('WHEN the name differs only by case THEN the inherited variable is replaced', (): void => {
      vi.stubEnv('PROCESS_FIXTURE_VALUE', 'inherited');

      const environment = agentEnvironment(withEnvironment('process_fixture_value', 'present'));

      expect(environment).not.toHaveProperty('PROCESS_FIXTURE_VALUE');
      expect(environment['process_fixture_value']).toBe('present');
    });
  });
});
