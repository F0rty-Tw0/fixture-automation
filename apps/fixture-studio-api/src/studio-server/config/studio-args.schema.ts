import { parseArgs } from 'node:util';
import type { ParseArgsOptionDescriptor, ParseArgsOptionsConfig } from 'node:util';

import { FixtureError } from '@fixture-automation/openapi-fixtures';

import type { StudioArgs } from '../common/studio-server.type.ts';

const MAX_PORT = 65_535;
const USAGE_FIX = 'run fixture-studio [--port <n>] [--no-open]';
const QUOTED_FLAG = /'([^']+)'/;
const PORT_OPTION = { type: 'string' } satisfies ParseArgsOptionDescriptor;
const NO_OPEN_OPTION = { type: 'boolean' } satisfies ParseArgsOptionDescriptor;
const STUDIO_OPTIONS = { port: PORT_OPTION, 'no-open': NO_OPEN_OPTION } satisfies ParseArgsOptionsConfig;

type StudioFlags = {
  readonly port?: string | undefined;
  readonly 'no-open'?: boolean | undefined;
};

const portArg = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;

  const value = Number(raw.trim());
  const isInteger = Number.isSafeInteger(value);
  const isInRange = isInteger && value > 0 && value <= MAX_PORT;

  if (!isInRange) throw new FixtureError(`--port must be an integer from 1 to ${MAX_PORT}, got "${raw}"`, 'pass e.g. --port 3333');

  return value;
};

const usageError = (error: Error): FixtureError => {
  const isUnknownOption = 'code' in error && error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION';
  const flag = QUOTED_FLAG.exec(error.message)?.[1];

  if (!isUnknownOption || flag === undefined) return new FixtureError(error.message, USAGE_FIX);

  return new FixtureError(`unknown option "${flag}"`, USAGE_FIX);
};

const parsedFlags = (argv: string[]): StudioFlags => {
  try {
    const parsed = parseArgs({ args: argv, strict: true, allowPositionals: false, options: STUDIO_OPTIONS });

    return parsed.values;
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;

    throw usageError(error);
  }
};

/** The `fixture-studio` command-line flags; an unknown flag, a stray argument or a bad port fails with a `FixtureError`. */
export const studioArgs = (argv: string[]): StudioArgs => {
  const flags = parsedFlags(argv);
  const port = portArg(flags.port);
  const isOpen = flags['no-open'] !== true;
  const args: StudioArgs = { port, isOpen };

  return args;
};
