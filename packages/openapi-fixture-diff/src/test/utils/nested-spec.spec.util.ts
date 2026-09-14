import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

export const nestedFile = (name: string): string => {
  const url = new URL(`../fixtures/nested/${name}`, import.meta.url);

  return fileURLToPath(url);
};

export const nestedSpecUrl = (): URL => {
  return new URL('../fixtures/nested/spec.json', import.meta.url);
};

export const nestedSpec = async (): Promise<OpenApiSpec> => {
  const spec = await loadSpec(nestedSpecUrl());

  return spec;
};

export const nestedOrder = async (): Promise<unknown> => {
  const text = await readFile(nestedFile('order.json'), 'utf8');
  const value: unknown = JSON.parse(text);

  return value;
};

/** The complete order plus the empty object a sampler leaves behind at the `parent` schema cycle. */
export const cyclicOrder = async (): Promise<unknown> => {
  const order = await nestedOrder();

  if (typeof order !== 'object' || order === null) throw new Error('the order fixture must be an object');

  const value = { ...order, parent: {} };

  return value;
};
