import { access } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { printHelp } from './cli-help.client.ts';
import { fixtures } from './fixtures.client.ts';
import { writeTextFile } from './json-file.client.ts';
import { loadSpec } from './openapi-spec.client.ts';
import { FixtureError } from '../common/fixture.error.ts';
import { FIXTURES_HELP, FIXTURES_INPUTS, FIXTURES_USAGE } from '../common/fixtures-cli.const.ts';
import type { Inputs } from '../common/input.type.ts';
import { schemaTarget } from '../utils/schema-name.util.ts';
import { silentInputs } from '../utils/silent-inputs.util.ts';
import { typescriptImport } from '../utils/typescript-import.util.ts';
import { typescriptStub } from '../utils/typescript-stub.util.ts';

const stringOption = { type: 'string' } as const;
const booleanOption = { type: 'boolean' } as const;
const helpOption = { type: 'boolean', short: 'h' } as const;
const cliOptions = { ts: stringOption, 'required-only': booleanOption, help: helpOption };

const typesImportFor = async (typesFile: string, outFile: string | undefined): Promise<string> => {
  if (!typesFile) throw new FixtureError('--ts requires a path to the generated types file');

  const hasDestination = outFile !== undefined && outFile !== '';
  const outputPath = resolve(hasDestination ? outFile : 'stub.ts');
  const typesPath = resolve(typesFile);
  const outputDifference = relative(typesPath, outputPath);

  if (hasDestination && !outputDifference) throw new FixtureError('the stub destination must differ from the types file');

  try {
    await access(typesPath);
  } catch {
    throw new FixtureError(`--ts file "${typesFile}" does not exist`, 'check the path; it is resolved from the current directory');
  }

  return typescriptImport(outputPath, typesPath);
};

export const runFixturesCli = async (args: string[], inputs: Inputs = silentInputs): Promise<void> => {
  const { positionals, values } = parseArgs({ args, options: cliOptions, allowPositionals: true });

  if (values.help === true) {
    printHelp(FIXTURES_HELP);

    return;
  }

  if (positionals.length > 3) throw new FixtureError(FIXTURES_USAGE);

  const specUrl = await inputs.required(positionals[0], FIXTURES_INPUTS.specUrl, FIXTURES_USAGE);
  const first = await inputs.optional(positionals[1], FIXTURES_INPUTS.schemaName);
  const second = await inputs.optional(positionals[2], FIXTURES_INPUTS.outFile);
  const typesFile = await inputs.optional(values.ts, FIXTURES_INPUTS.ts);
  const requiredOnly = await inputs.flag(values['required-only'], FIXTURES_INPUTS.requiredOnly);
  const spec = await loadSpec(specUrl);
  const { schemaName, outFile } = schemaTarget(spec, first, second);
  let typesImport: string | undefined;

  if (typesFile !== undefined) typesImport = await typesImportFor(typesFile, outFile);

  const sampleOptions = { skipNonRequired: requiredOnly };
  const fixture = fixtures(spec, sampleOptions)(schemaName);
  const json = JSON.stringify(fixture, null, 2);
  let output = `${json}\n`;

  if (typesImport !== undefined) output = typescriptStub(schemaName, typesImport, json);

  if (outFile !== undefined && outFile !== '') {
    await writeTextFile(outFile, output);

    return;
  }

  process.stdout.write(output);
};
