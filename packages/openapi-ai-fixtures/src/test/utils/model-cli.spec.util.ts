import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type { CliResult } from '../common/integration.type.ts';

const execute = promisify(execFile);
const cliFile = fileURLToPath(new URL('../../cli.ts', import.meta.url));

export const runModelCli = async (args: string[]): Promise<CliResult> => {
  return execute(process.execPath, ['--conditions=@fixture-automation/source', cliFile, '--list-models', ...args], { timeout: 20000 });
};
