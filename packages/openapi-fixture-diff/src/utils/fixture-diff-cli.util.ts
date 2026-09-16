import { parseArgs } from 'node:util';

import { FixtureError, silentInputs } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { CORRUPT_USAGE, DIFF_INPUTS, DIFF_USAGE } from '../common/fixture-diff-cli.const.ts';
import type { CorruptOptions, DiffOptions } from '../common/fixture-diff-cli.type.ts';

const stringOption = { type: 'string' } as const;
const booleanOption = { type: 'boolean' } as const;
const helpOption = { type: 'boolean', short: 'h' } as const;
const corruptOptions = { drop: stringOption, help: helpOption };
const diffOptions = {
  fixture: stringOption,
  'object-shape': stringOption,
  'out-dir': stringOption,
  'required-only': booleanOption,
  help: helpOption
};
const DROP_USAGE = '--drop requires a comma separated list of fixture paths';

const droppedPaths = (drop: string): string[] => {
  const paths = drop.split(',').map((path) => path.trim());
  const hasEmptyPath = paths.some((path) => !path);

  if (hasEmptyPath) throw new FixtureError(DROP_USAGE, 'example: --drop id,customer.email,lines[1].sku');

  return paths;
};

/** Parse the corrupt command line; `undefined` means the caller should print help. */
export const parseCorruptArgs = async (args: string[], inputs: Inputs = silentInputs): Promise<CorruptOptions | undefined> => {
  const { positionals, values } = parseArgs({ args, options: corruptOptions, allowPositionals: true });

  if (values.help === true) return undefined;

  if (positionals.length > 2) throw new FixtureError(CORRUPT_USAGE);

  const fixtureFile = await inputs.required(positionals[0], DIFF_INPUTS.fixtureFile, CORRUPT_USAGE);
  const outFile = await inputs.required(positionals[1], DIFF_INPUTS.outFile, CORRUPT_USAGE);
  const drop = await inputs.required(values.drop, DIFF_INPUTS.drop, DROP_USAGE, 'example: --drop id,customer.email,lines[1].sku');
  const paths = droppedPaths(drop);
  const options: CorruptOptions = { fixtureFile, outFile, paths };

  return options;
};

/** Parse the diff command line; `undefined` means the caller should print help. */
export const parseDiffArgs = async (args: string[], inputs: Inputs = silentInputs): Promise<DiffOptions | undefined> => {
  const { positionals, values } = parseArgs({ args, options: diffOptions, allowPositionals: true });

  if (values.help === true) return undefined;

  if (positionals.length > 2) throw new FixtureError(DIFF_USAGE);

  const specUrl = await inputs.required(positionals[0], DIFF_INPUTS.specUrl, DIFF_USAGE);
  const fixtureFile = await inputs.required(
    values.fixture,
    DIFF_INPUTS.fixture,
    '--fixture requires an existing JSON fixture file',
    'pass the corrupt fixture written by corrupt'
  );
  const outDir = await inputs.required(values['out-dir'], DIFF_INPUTS.outDir, '--out-dir requires a destination directory');
  const schemaName = await inputs.optional(positionals[1], DIFF_INPUTS.schemaName);
  const objectShapeAnswer = await inputs.optional(values['object-shape'], DIFF_INPUTS.objectShape);
  const trimmedShape = objectShapeAnswer?.trim();
  const objectShape = trimmedShape === '' ? undefined : trimmedShape;
  const requiredOnly = await inputs.flag(values['required-only'], DIFF_INPUTS.requiredOnly);
  const options: DiffOptions = { specUrl, schemaName, fixtureFile, outDir, requiredOnly, objectShape };

  return options;
};
