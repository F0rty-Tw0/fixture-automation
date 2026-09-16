import { parseArgs } from 'node:util';

import { FixtureError, silentInputs } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { MERGE_INPUTS, MERGE_USAGE } from '../common/fixture-merge-cli.const.ts';
import type { MergeInput, MergeSpec } from '../common/fixture-merge.type.ts';

const stringOption = { type: 'string' } as const;
const helpOption = { type: 'boolean', short: 'h' } as const;
const cliOptions = {
  'endpoint-url': stringOption,
  spec: stringOption,
  schema: stringOption,
  help: helpOption
};

/** `--schema` needs `--spec`; `--spec` alone defaults the name from the spec's `x-root-schema`. */
const validationSpec = (url: string | undefined, schemaName: string | undefined): MergeSpec | undefined => {
  const hasSchemaName = schemaName !== undefined;

  if (url === undefined && !hasSchemaName) return undefined;

  if (url === undefined) throw new FixtureError('--schema requires --spec', '--spec <url> --schema invoice');

  if (!url || schemaName === '') throw new FixtureError('--spec and --schema require non-empty values');

  const spec: MergeSpec = { url, schemaName };

  return spec;
};

/** Parse the merge command line; `undefined` means the caller should print usage. */
export const parseMergeArgs = async (args: string[], inputs: Inputs = silentInputs): Promise<MergeInput | undefined> => {
  const { positionals, values } = parseArgs({ args, options: cliOptions, allowPositionals: true });

  if (values.help) return undefined;

  if (positionals.length > 3) throw new FixtureError(MERGE_USAGE);

  const corruptFile = await inputs.required(positionals[0], MERGE_INPUTS.corruptFile, MERGE_USAGE);
  const populatedFile = await inputs.required(positionals[1], MERGE_INPUTS.populatedFile, MERGE_USAGE);
  const outDir = await inputs.required(positionals[2], MERGE_INPUTS.outDir, MERGE_USAGE);
  const endpointUrl = await inputs.required(values['endpoint-url'], MERGE_INPUTS.endpointUrl, MERGE_USAGE);
  const specUrl = await inputs.optional(values.spec, MERGE_INPUTS.spec);
  let schemaName = values.schema;

  if (specUrl !== undefined) schemaName = await inputs.optional(values.schema, MERGE_INPUTS.schema);

  const spec = validationSpec(specUrl, schemaName);
  const base: MergeInput = { corruptFile, populatedFile, outDir, endpointUrl };

  if (spec === undefined) return base;

  const input: MergeInput = { ...base, spec };

  return input;
};
