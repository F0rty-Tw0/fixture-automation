import type { SpecSchema } from '@fixture-automation/openapi-fixture-diff';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

/** `spec` plus `invoiceList`, an array component schema of `invoice`, and `bareList`, an array schema without items. */
export const listSpec = (spec: OpenApiSpec): OpenApiSpec => {
  const items: SpecSchema = { $ref: '#/components/schemas/invoice' };
  const invoiceList: SpecSchema = { type: 'array', items };
  const bareList: SpecSchema = { type: 'array' };
  const existing = spec.components?.schemas;
  const schemas = { ...existing, invoiceList, bareList };
  const components = { ...spec.components, schemas };
  const listed: OpenApiSpec = { ...spec, components };

  return listed;
};

/** A bare spec of `schemas` alone, for cases that need their own components. */
export const schemasSpec = (schemas: Record<string, SpecSchema>, openapi = '3.0.3'): OpenApiSpec => {
  const info = { title: 'schemas', version: '1' };
  const components = { schemas };
  const spec: OpenApiSpec = { openapi, info, paths: {}, components };

  return spec;
};
