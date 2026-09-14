import { parseArgs } from 'node:util';

import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { CORRUPT_USAGE, DIFF_USAGE } from '../common/fixture-diff-cli.const.ts';
import type { CorruptOptions, DiffOptions } from '../common/fixture-diff-cli.type.ts';

const stringOption = { type: 'string' } as const;
const booleanOption = { type: 'boolean' } as const;
const helpOption = { type: 'boolean', short: 'h' } as const;
const corruptOptions = { drop: stringOption, help: helpOption };
const diffOptions = { fixture: stringOption, 'out-dir': stringOption, 'required-only': booleanOption, help: helpOption };
const DROP_USAGE = '--drop requires a comma separated list of fixture paths';

const requiredValue = (value: string | undefined, message: string, fix?: string): string => {
  if (!value) throw new FixtureError(message, fix);

  return value;
};

const droppedPaths = (drop: string): string[] => {
  const paths = drop.split(',').map((path) => path.trim());
  const hasEmptyPath = paths.some((path) => !path);

  if (hasEmptyPath) throw new FixtureError(DROP_USAGE, 'example: --drop id,customer.email,lines[1].sku');

  return paths;
};

/** Parse the corrupt command line; `undefined` means the caller should print help. */
export const parseCorruptArgs = (args: string[]): CorruptOptions | undefined => {
  const { positionals, values } = parseArgs({ args, options: corruptOptions, allowPositionals: true });

  if (values.help === true) return undefined;

  if (positionals.length !== 2) throw new FixtureError(CORRUPT_USAGE);

  const fixtureFile = requiredValue(positionals[0], CORRUPT_USAGE);
  const outFile = requiredValue(positionals[1], CORRUPT_USAGE);
  const paths = droppedPaths(requiredValue(values.drop, DROP_USAGE, 'example: --drop id,customer.email,lines[1].sku'));
  const options: CorruptOptions = { fixtureFile, outFile, paths };

  return options;
};

/** Parse the diff command line; `undefined` means the caller should print help. */
export const parseDiffArgs = (args: string[]): DiffOptions | undefined => {
  const { positionals, values } = parseArgs({ args, options: diffOptions, allowPositionals: true });

  if (values.help === true) return undefined;

  const isUsage = positionals.length === 0 || positionals.length > 2;

  if (isUsage) throw new FixtureError(DIFF_USAGE);

  const specUrl = requiredValue(positionals[0], DIFF_USAGE);
  const schemaName = positionals[1];
  const fixtureFile = requiredValue(
    values.fixture,
    '--fixture requires an existing JSON fixture file',
    'pass the corrupt fixture written by corrupt'
  );
  const outDir = requiredValue(values['out-dir'], '--out-dir requires a destination directory');
  const requiredOnly = values['required-only'] === true;
  const options: DiffOptions = { specUrl, schemaName, fixtureFile, outDir, requiredOnly };

  return options;
};
