import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSpecUrl, typescriptImport, typescriptStub } from '@fixture-automation/openapi-fixtures';
import { isMissingFile } from '@fixture-automation/shared';

import type { AiFixtureCliOptions, FixtureOutput } from '../common/ai-fixtures-cli.type.ts';

const destinationPath = async (file: string): Promise<string> => {
  try {
    return await realpath(file);
  } catch (error: unknown) {
    const isMissing = isMissingFile(error);

    if (isMissing) return file;

    throw error;
  }
};

export const prepareOutput = async (options: AiFixtureCliOptions): Promise<FixtureOutput> => {
  let file: string | undefined;
  const sourceFiles = [resolve(options.fixtureFile)];
  let typesImport: string | undefined;

  if (options.outFile !== undefined) file = resolve(options.outFile);

  if (options.specUrl !== undefined) {
    const specUrl = parseSpecUrl(options.specUrl);

    if (specUrl.protocol === 'file:') sourceFiles.push(fileURLToPath(specUrl));
  }

  if (options.typesFile !== undefined) {
    if (file === undefined) throw new Error('--ts requires an output file to resolve the types import');

    const typesPath = await realpath(options.typesFile);

    sourceFiles.push(typesPath);
    typesImport = typescriptImport(file, typesPath);
  }

  if (file !== undefined) {
    const destination = await destinationPath(file);

    for (const source of sourceFiles) {
      const input = await realpath(source);
      const difference = relative(input, destination);

      if (!difference) throw new Error('the destination must differ from the fixture, spec, and types inputs');
    }
  }

  const output: FixtureOutput = { file, typesImport };

  return output;
};

export const writeFixtureOutput = async (target: FixtureOutput, schemaName: string, fixture: unknown): Promise<void> => {
  const json: unknown = JSON.stringify(fixture, null, 2);

  if (typeof json !== 'string') throw new Error('cannot write a non-JSON fixture');

  let source = `${json}\n`;

  if (target.typesImport !== undefined) {
    source = typescriptStub(schemaName, target.typesImport, json);
  }

  if (target.file === undefined) {
    process.stdout.write(source);

    return;
  }

  await mkdir(dirname(target.file), { recursive: true });

  const directory = await mkdtemp(join(dirname(target.file), '.ai-fixture-'));

  try {
    const staged = join(directory, 'fixture');

    await writeFile(staged, source, { flag: 'wx' });
    await rename(staged, target.file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
