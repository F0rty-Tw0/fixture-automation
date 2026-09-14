import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { CliResult } from '../common/cli-result.type.ts';

const CLI_TIMEOUT = 30000;

/** `execFile` reports a signal as a string code; only a numeric exit code is meaningful here. */
const exitCode = (error: ExecFileException | null): number => {
  if (error === null) return 0;

  if (typeof error.code === 'number') return error.code;

  return 1;
};

/** Spawns `src/cli.ts` with the workspace source condition; stdin is a pipe, so the wizard sees no terminal. */
export const spawnWizardCli = async (args: string[]): Promise<CliResult> => {
  const cliFile = fileURLToPath(new URL('../../cli.ts', import.meta.url));
  const commandArgs = ['--conditions=@fixture-automation/source', cliFile, ...args];
  const spawn = (settle: (result: CliResult) => void): void => {
    const done = (error: ExecFileException | null, stdout: string, stderr: string): void => {
      settle({ stdout, stderr, code: exitCode(error) });
    };

    execFile(process.execPath, commandArgs, { timeout: CLI_TIMEOUT }, done);
  };

  return new Promise(spawn);
};
