import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

type SpecComponents = NonNullable<OpenApiSpec['components']>;

/** The JSON Schema shape carried by every `components.schemas` entry. */
export type SpecSchema = NonNullable<SpecComponents['schemas']>[string];

export type SpecSchemas = Record<string, SpecSchema>;

export type SchemaComponents = {
  readonly schemas: SpecSchemas;
};
