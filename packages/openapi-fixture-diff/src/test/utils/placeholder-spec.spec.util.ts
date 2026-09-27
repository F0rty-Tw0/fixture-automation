import { readFile } from 'node:fs/promises';

import { fixtures, loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

/** An OpenAPI 3.1 `account` mixing plain, formatted, author-valued, union and array properties. */
export const placeholderSpec = async (): Promise<OpenApiSpec> => {
  const specUrl = new URL('../fixtures/placeholder/spec.json', import.meta.url);

  return loadSpec(specUrl);
};

/** The `account` our own generator writes: every optional property included, every leaf a sampler value. */
export const generatedAccount = (spec: OpenApiSpec): Record<string, unknown> => {
  const sampleOptions = { skipNonRequired: false };
  const account: unknown = fixtures(spec, sampleOptions)('account');

  if (!isRecord(account)) throw new Error('the generated account must be an object');

  return account;
};

/** A hand-written `account` of real, schema-valid values: nothing in it is a placeholder. */
export const realAccount = async (): Promise<Record<string, unknown>> => {
  const fileUrl = new URL('../fixtures/placeholder/account.json', import.meta.url);
  const text = await readFile(fileUrl, 'utf8');
  const value: unknown = JSON.parse(text);

  if (!isRecord(value)) throw new Error('the account fixture must be an object');

  return value;
};
