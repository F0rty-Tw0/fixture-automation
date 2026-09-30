import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { SpecSchemas } from '../../schema/common/schema.type.ts';

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

export const nestedOrder = async (): Promise<Record<string, unknown>> => {
  const text = await readFile(nestedFile('order.json'), 'utf8');
  const value: unknown = JSON.parse(text);

  if (!isRecord(value)) throw new Error('the order fixture must be an object');

  return value;
};

/** The complete order plus the empty object a sampler leaves behind at the `parent` schema cycle. */
export const cyclicOrder = async (): Promise<Record<string, unknown>> => {
  const order = await nestedOrder();
  const value = { ...order, parent: {} };

  return value;
};

/** A bare spec holding only `schemas`, for cases that need their own components. */
export const schemaSpec = (schemas: SpecSchemas, openapi = '3.0.3'): OpenApiSpec => {
  const info = { title: 'schemas', version: '1' };
  const components = { schemas };
  const spec: OpenApiSpec = { openapi, info, paths: {}, components };

  return spec;
};
