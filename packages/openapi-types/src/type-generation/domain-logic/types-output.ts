import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { styleText } from 'node:util';

import { FixtureError, loadSpec, pruneSpec, writeTextFile } from '@fixture-automation/openapi-fixtures';

import type { OutputFiles } from '../common/openapi-types-cli.type.ts';
import { generateTypes } from '../data-access/openapi-types.client.ts';

const TYPES_SUFFIX = '.d.ts';
const SPEC_SUFFIX = '.spec.json';
const YAML_SUFFIXES = ['.yaml', '.yml'];

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

export const generate = async (specUrl: string, outFile: string | undefined): Promise<void> => {
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
export const generatePruned = async (specUrl: string, schemaName: string, outFile: string): Promise<void> => {
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
