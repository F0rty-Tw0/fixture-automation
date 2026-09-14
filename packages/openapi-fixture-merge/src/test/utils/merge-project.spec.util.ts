import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import type { CliResult, MergeProject } from '../common/merge-project.type.ts';

const execute = promisify(execFile);

const CORRUPT_FIXTURE = '{ "id": "in_1", "amount_due": 100 }\n';
const POPULATED_FIXTURE = '{ "status": "open" }\n';

/** `file://` URL of the invoice spec shared with `@fixture-automation/openapi-fixtures`. */
export const invoiceSpecUrl = (): string => {
  const url = new URL('../../../../openapi-fixtures/src/test/fixtures/invoice/spec.json', import.meta.url);

  return url.href;
};

export const mergeProject = async (): Promise<MergeProject> => {
  const directory = await mkdtemp(join(tmpdir(), 'fixture-merge-'));
  const dispose = async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  };

  try {
    const write = async (name: string, source: string): Promise<string> => {
      const file = join(directory, name);

      await writeFile(file, source);

      return file;
    };
    const run = async (args: string[]): Promise<CliResult> => {
      const cliFile = fileURLToPath(new URL('../../cli.ts', import.meta.url));
      const commandArgs = ['--conditions=@fixture-automation/source', cliFile, ...args];
      const result = await execute(process.execPath, commandArgs, { cwd: directory, timeout: 30000 });

      return result;
    };

    await write('package.json', '{ "type": "module" }\n');

    const corruptFile = await write('corrupt.json', CORRUPT_FIXTURE);
    const populatedFile = await write('populated.json', POPULATED_FIXTURE);
    const outFile = join(directory, 'invoice.fixed.json');
    const specUrl = invoiceSpecUrl();
    const project: MergeProject = { directory, corruptFile, populatedFile, outFile, specUrl, write, run, dispose };

    return project;
  } catch (error: unknown) {
    await dispose();

    throw error;
  }
};
