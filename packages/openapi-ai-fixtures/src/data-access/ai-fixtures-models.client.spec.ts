import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { CURATED_MODELS } from '../common/models.const.ts';
import type { CliResult } from '../test/common/integration.type.ts';

const execute = promisify(execFile);
const cliFile = fileURLToPath(new URL('../cli.ts', import.meta.url));
const cacheHome = fileURLToPath(new URL('../test/fixtures/codex-home', import.meta.url));
const absentHome = fileURLToPath(new URL('../test/fixtures/codex-home-absent', import.meta.url));

const runCli = async (args: string[], home: string): Promise<CliResult> => {
  const env: NodeJS.ProcessEnv = { ...process.env };

  env['CODEX_HOME'] = home;

  const options = { env, timeout: 20000 };
  const result = await execute(process.execPath, ['--conditions=@fixture-automation/source', cliFile, ...args], options);

  return result;
};

describe('FEATURE: AI model listing command', (): void => {
  describe('GIVEN a Codex cache reachable through CODEX_HOME', (): void => {
    it('WHEN models are listed THEN prints the cached slugs and reports the cache source', async (): Promise<void> => {
      const result = await runCli(['--list-models', '--tool', 'codex'], cacheHome);

      expect(result.stdout).toBe('gpt-cache-a\ngpt-cache-b\n');
      expect(result.stderr).toContain('source: codex-cache');
    });
  });

  describe('GIVEN no reachable Codex cache', (): void => {
    it('WHEN models are listed THEN prints the curated slugs and reports the curated source', async (): Promise<void> => {
      const result = await runCli(['--list-models', '--tool', 'codex'], absentHome);
      const expected = `${CURATED_MODELS.codex.join('\n')}\n`;

      expect(result.stdout).toBe(expected);
      expect(result.stderr).toContain('source: curated');
    });
  });

  describe('GIVEN a harness listed from the curated fallback', (): void => {
    it('WHEN Claude models are listed THEN prints them without loading a spec', async (): Promise<void> => {
      const result = await runCli(['--list-models', '--tool', 'claude'], cacheHome);
      const expected = `${CURATED_MODELS.claude.join('\n')}\n`;

      expect(result.stdout).toBe(expected);
      expect(result.stderr).toContain('source: curated');
    });
  });

  describe('GIVEN a model listing without a harness', (): void => {
    it('WHEN models are listed THEN rejects rather than choosing a provider', async (): Promise<void> => {
      const listing = runCli(['--list-models'], cacheHome);

      await expect(listing).rejects.toMatchObject({ code: 1 });
    });
  });
});
