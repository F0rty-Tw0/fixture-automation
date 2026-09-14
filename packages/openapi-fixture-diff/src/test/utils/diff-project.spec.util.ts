import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { nestedFile } from './nested-spec.spec.util.ts';
import type { CliResult, DiffProject } from '../common/diff-project.type.ts';

const execute = promisify(execFile);

export const diffProject = async (): Promise<DiffProject> => {
  const directory = await mkdtemp(join(tmpdir(), 'fixture-diff-'));
  const dispose = async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  };

  try {
    const cliUrl = new URL('../../cli.ts', import.meta.url);
    const cliFile = fileURLToPath(cliUrl);
    const specUrl = pathToFileURL(join(directory, 'spec.json')).href;
    const fixtureFile = join(directory, 'order.json');
    const corruptFile = join(directory, 'corrupt.json');
    const run = async (args: string[]): Promise<CliResult> => {
      const commandArgs = ['--conditions=@fixture-automation/source', cliFile, ...args];
      const result = await execute(process.execPath, commandArgs, { cwd: directory, timeout: 60000 });

      return result;
    };
    const project: DiffProject = { directory, specUrl, fixtureFile, corruptFile, run, dispose };

    await cp(nestedFile(''), directory, { recursive: true });

    return project;
  } catch (error: unknown) {
    await dispose();

    throw error;
  }
};
