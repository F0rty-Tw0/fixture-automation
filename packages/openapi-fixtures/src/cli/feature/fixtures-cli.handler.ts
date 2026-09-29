import { parseArgs } from 'node:util';

import { printHelp } from './cli-help.handler.ts';
import type { Inputs } from '../../prompt/common/input.type.ts';
import { silentInputs } from '../../prompt/utils/silent-inputs.util.ts';
import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';
import { loadSpec } from '../../spec-loading/domain-logic/openapi-spec.ts';
import { FIXTURES_HELP, FIXTURES_INPUTS, FIXTURES_USAGE } from '../common/fixtures-cli.const.ts';
import { fixtureOutput, writeFixtureOutput } from '../domain-logic/fixture-output.ts';
import { typesImportFor } from '../domain-logic/types-import.ts';
import { askSchemaName, schemaTarget } from '../utils/schema-name.util.ts';

const stringOption = { type: 'string' } as const;
const booleanOption = { type: 'boolean' } as const;
const helpOption = { type: 'boolean', short: 'h' } as const;
const cliOptions = { ts: stringOption, 'required-only': booleanOption, help: helpOption };

export const runFixturesCli = async (args: string[], inputs: Inputs = silentInputs): Promise<void> => {
  const { positionals, values } = parseArgs({ args, options: cliOptions, allowPositionals: true });

  if (values.help === true) {
    printHelp(FIXTURES_HELP);

    return;
  }

  if (positionals.length > 3) throw new FixtureError(FIXTURES_USAGE);

  const specUrl = await inputs.required(positionals[0], FIXTURES_INPUTS.specUrl, FIXTURES_USAGE);
  const spec = await loadSpec(specUrl);
  const first = await askSchemaName(spec, positionals[1], FIXTURES_INPUTS.schemaName, inputs);
  const second = await inputs.optional(positionals[2], FIXTURES_INPUTS.outFile);
  const typesFile = await inputs.optional(values.ts, FIXTURES_INPUTS.ts);
  const requiredOnly = await inputs.flag(values['required-only'], FIXTURES_INPUTS.requiredOnly);
  const { schemaName, outFile } = schemaTarget(spec, first, second);
  let typesImport: string | undefined;

  if (typesFile !== undefined) typesImport = await typesImportFor(typesFile, outFile);

  const output = fixtureOutput(spec, schemaName, requiredOnly, typesImport);

  await writeFixtureOutput(outFile, output);
};
