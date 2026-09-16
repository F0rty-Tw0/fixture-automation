import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, styleText } from 'node:util';

import { FixtureError, loadSpec, printHelp, pruneSpec, silentInputs, writeTextFile } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { generateTypes } from './openapi-types.client.ts';
import { OPENAPI_TYPES_HELP, OPENAPI_TYPES_USAGE, TYPES_INPUTS } from '../common/openapi-types-cli.const.ts';
import type { OutputFiles } from '../common/openapi-types-cli.type.ts';

const TYPES_SUFFIX = '.d.ts';
const SPEC_SUFFIX = '.spec.json';
const YAML_SUFFIXES = ['.yaml', '.yml'];
const helpOption = { type: 'boolean', short: 'h' } as const;
const cliOptions = { help: helpOption };

const errorCode = (error: unknown): string => {
  if (!(error instanceof Error)) return '';

  if (!('code' in error)) return '';

  if (typeof error.code !== 'string') return '';

  return error.code;
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  return String(error);
};

/** `openapi-typescript` reports a missing spec as a raw ENOENT; give it the wording the other tools use. */
const loadFailure = (error: unknown, specUrl: string): FixtureError => {
  const message = errorMessage(error);
  const code = errorCode(error);
  const isBarePath = code === 'ERR_INVALID_URL';

  if (isBarePath) {
    const href = pathToFileURL(resolve(specUrl)).href;

    return new FixtureError(`spec must be a URL, got bare path "${specUrl}"`, `use ${href}`);
  }

  const isMissingFile = message.startsWith('ENOENT:');

  if (isMissingFile) return new FixtureError(`spec file not found: ${specUrl}`, 'check the path inside the file:// URL');

  const isUnreachable = message.startsWith('Failed to load ');

  if (isUnreachable) return new FixtureError(message, 'open the URL in a browser; it must return a raw spec');

  const isOffline = message === 'fetch failed';

  if (isOffline) return new FixtureError(`spec download failed for ${specUrl}`, 'check the host name and your network access');

  return new FixtureError(message);
};

const generate = async (specUrl: string, outFile: string | undefined): Promise<void> => {
  let types: string;

  try {
    types = await generateTypes(specUrl);
  } catch (error: unknown) {
    throw loadFailure(error, specUrl);
  }

  if (outFile === undefined) {
    process.stdout.write(types);

    return;
  }

  await writeTextFile(outFile, types);
};

/** `tmp/invoice.d.ts` and `tmp/invoice` both write `tmp/invoice.d.ts` next to `tmp/invoice.spec.json`. */
const outputFiles = (outFile: string): OutputFiles => {
  const hasTypesSuffix = outFile.endsWith(TYPES_SUFFIX);
  const stripped = outFile.slice(0, -TYPES_SUFFIX.length);
  const stem = hasTypesSuffix ? stripped : outFile;
  const files: OutputFiles = { typesFile: `${stem}${TYPES_SUFFIX}`, specFile: `${stem}${SPEC_SUFFIX}` };

  return files;
};

/** Prune the spec to one schema, write it next to the types, and generate the types from the pruned copy. */
const generatePruned = async (specUrl: string, schemaName: string, outFile: string): Promise<void> => {
  const lowered = specUrl.toLowerCase();
  const isYaml = YAML_SUFFIXES.some((suffix: string): boolean => lowered.endsWith(suffix));

  if (isYaml) throw new FixtureError('schema-name requires a JSON spec', 'convert the YAML to JSON, or omit the schema name');

  const spec = await loadSpec(specUrl);
  const pruned = pruneSpec(spec, schemaName);
  const { typesFile, specFile } = outputFiles(outFile);
  const types = await generateTypes(pruned);
  const count = Object.keys(pruned.components?.schemas ?? {}).length;

  await writeTextFile(specFile, `${JSON.stringify(pruned, null, 2)}\n`);
  await writeTextFile(typesFile, types);

  const success = styleText('green', `wrote ${typesFile} and ${specFile} (${count} schemas reachable from ${schemaName})\n`, {
    stream: process.stderr
  });

  process.stderr.write(success);
};

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

  // ponytail: a bare 2-positional run gives positionals[1] to the `schemaName` slot even though it
  // means out-file there; only a prompt-answered schema name (positionals[1] unset) needs its own out-file
  const schemaWasPrompted = positionals[1] === undefined && schemaName !== undefined;

  if (schemaWasPrompted) throw new FixtureError('schema-name needs an out-file', 'answer out-file, e.g. invoice.d.ts');

  await generate(specUrl, outFile ?? schemaName);
};
