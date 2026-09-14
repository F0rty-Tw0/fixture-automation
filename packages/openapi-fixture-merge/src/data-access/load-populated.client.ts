import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { FixtureError, readJsonFile } from '@fixture-automation/openapi-fixtures';

import { MODULE_EXTENSIONS } from '../common/fixture-merge-cli.const.ts';

const SINGLE_EXPORT = 'populated module must export exactly one value';
const SUPPORTED_EXTENSIONS = 'populated file must be .json, .ts, .mts, .js, or .mjs';

const namespaceValue = (namespace: unknown): unknown => {
  const isNamespace = typeof namespace === 'object' && namespace !== null;

  if (!isNamespace) throw new Error(SINGLE_EXPORT);

  const entries: [string, unknown][] = Object.entries(namespace);
  const exported = entries.filter(([key, value]: [string, unknown]): boolean => {
    const isEmptyDefault = key === 'default' && value === undefined;

    return !isEmptyDefault;
  });
  const [entry] = exported;
  const isSingle = exported.length === 1 && entry !== undefined;

  if (!isSingle) throw new Error(SINGLE_EXPORT);

  const [, value] = entry;

  return value;
};

/** Read an AI-populated fixture from JSON, or from a module whose single export holds the value. */
export const loadPopulated = async (file: string): Promise<unknown> => {
  const extension = extname(file).toLowerCase();

  if (extension === '.json') {
    const parsed = await readJsonFile('populated', file);

    return parsed;
  }

  const isModule = MODULE_EXTENSIONS.includes(extension);

  if (!isModule) throw new FixtureError(SUPPORTED_EXTENSIONS, `rename it to .json, or use one of ${MODULE_EXTENSIONS.join(', ')}`);

  const url = pathToFileURL(resolve(file));
  const namespace: unknown = await import(url.href);

  return namespaceValue(namespace);
};
