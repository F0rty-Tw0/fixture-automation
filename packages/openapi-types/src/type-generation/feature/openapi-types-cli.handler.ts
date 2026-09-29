import { parseArgs } from 'node:util';

import { FixtureError, printHelp, silentInputs } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { OPENAPI_TYPES_HELP, OPENAPI_TYPES_USAGE, TYPES_INPUTS } from '../common/openapi-types-cli.const.ts';
import { generate, generatePruned } from '../domain-logic/types-output.ts';

const helpOption = { type: 'boolean', short: 'h' } as const;
const cliOptions = { help: helpOption };

export const runTypesCli = async (args: string[], inputs: Inputs = silentInputs): Promise<void> => {
  const { positionals, values } = parseArgs({ args, options: cliOptions, allowPositionals: true });

  if (values.help === true) {
    printHelp(OPENAPI_TYPES_HELP);

    return;
  }

  if (positionals.length > 3) throw new FixtureError(OPENAPI_TYPES_USAGE);

  const specUrl = await inputs.required(positionals[0], TYPES_INPUTS.specUrl, OPENAPI_TYPES_USAGE);
  const schemaName = await inputs.optional(positionals[1], TYPES_INPUTS.schemaName);
  const outFile = await inputs.optional(positionals[2], TYPES_INPUTS.outFile);

  if (schemaName !== undefined && outFile !== undefined) return generatePruned(specUrl, schemaName, outFile);

  // A bare 2-positional run puts the out-file in positionals[1], the `schemaName` slot;
  // only a prompt-answered schema name (positionals[1] unset) still needs an out-file.
  const schemaWasPrompted = positionals[1] === undefined && schemaName !== undefined;

  if (schemaWasPrompted) throw new FixtureError('schema-name needs an out-file', 'answer out-file, e.g. invoice.d.ts');

  await generate(specUrl, outFile ?? schemaName);
};
