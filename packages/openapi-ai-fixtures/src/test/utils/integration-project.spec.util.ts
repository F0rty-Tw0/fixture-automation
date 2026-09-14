import { execFile } from 'node:child_process';
import { cp, mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import type { CliResult, IntegrationProject } from '../common/integration.type.ts';

const execute = promisify(execFile);

export const integrationFile = (name: string): string => {
  const url = new URL(`../fixtures/integration/${name}`, import.meta.url);

  return fileURLToPath(url);
};

export const integrationProject = async (): Promise<IntegrationProject> => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-fixture-integration-'));
  const dispose = async (): Promise<void> => {
    await rm(directory, { recursive: true, force: true });
  };

  try {
    const source = integrationFile('');
    const cliUrl = new URL('../../cli.ts', import.meta.url);
    const cliFile = fileURLToPath(cliUrl);
    const fixtureFile = join(directory, 'invoice.json');
    const typesFile = join(directory, 'api.d.ts');
    const executable = join(directory, 'enricher.mjs');
    const outputFile = join(directory, 'generated.stub.ts');
    const specUrl = pathToFileURL(join(directory, 'spec.json')).href;
    const run = async (args: string[]): Promise<CliResult> => {
      const commandArgs = ['--conditions=@fixture-automation/source', cliFile, ...args];
      const result = await execute(process.execPath, commandArgs, { cwd: directory, timeout: 20000 });

      return result;
    };
    const compile = async (): Promise<unknown> => {
      const compilerUrl = import.meta.resolve('typescript/bin/tsc');
      const compiler = fileURLToPath(compilerUrl);
      const consumer = pathToFileURL(join(directory, 'dist/consumer.js')).href;
      const script = `const { invoice } = await import(${JSON.stringify(consumer)}); process.stdout.write(JSON.stringify(invoice));`;

      await execute(process.execPath, [compiler, '--project', join(directory, 'tsconfig.json')], { timeout: 20000 });

      const compiled = await execute(process.execPath, ['--input-type=module', '--eval', script], { cwd: directory, timeout: 10000 });
      const value: unknown = JSON.parse(compiled.stdout);

      return value;
    };
    const project: IntegrationProject = { directory, specUrl, fixtureFile, typesFile, executable, outputFile, run, compile, dispose };

    await cp(source, directory, { recursive: true });
    await rename(join(directory, 'manifest.fixture.json'), join(directory, 'package.json'));
    await rename(join(directory, 'compiler.fixture.json'), join(directory, 'tsconfig.json'));

    return project;
  } catch (error: unknown) {
    await dispose();

    throw error;
  }
};
