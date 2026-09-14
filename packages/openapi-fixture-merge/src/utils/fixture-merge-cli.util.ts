import { parseArgs } from 'node:util';

import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { MERGE_USAGE } from '../common/fixture-merge-cli.const.ts';
import type { MergeInput, MergeSpec } from '../common/fixture-merge.type.ts';

const stringOption = { type: 'string' } as const;
const helpOption = { type: 'boolean', short: 'h' } as const;
const cliOptions = {
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
export const parseMergeArgs = (args: string[]): MergeInput | undefined => {
  const { positionals, values } = parseArgs({ args, options: cliOptions, allowPositionals: true });

  if (values.help) return undefined;

  const [corruptFile, populatedFile, outFile] = positionals;
  const isComplete = positionals.length === 3 && corruptFile !== undefined && populatedFile !== undefined && outFile !== undefined;

  if (!isComplete) throw new FixtureError(MERGE_USAGE);

  const spec = validationSpec(values.spec, values.schema);
  const base: MergeInput = { corruptFile, populatedFile, outFile };

  if (spec === undefined) return base;

  const input: MergeInput = { ...base, spec };

  return input;
};
