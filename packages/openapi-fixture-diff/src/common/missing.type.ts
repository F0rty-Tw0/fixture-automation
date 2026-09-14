import type { SchemaDialect } from '@fixture-automation/openapi-ai-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import type { SchemaComponents, SpecSchema, SpecSchemas } from './schema.type.ts';

export type MissingEntry = {
  readonly path: string;
  readonly schema: SpecSchema;
};

export type WalkInput = {
  readonly schema: SpecSchema;
  readonly value: unknown;
  readonly path: string;
  readonly schemas: SpecSchemas;
  readonly requiredOnly: boolean;
  readonly ancestry: string[];
};

export type WalkFunction = (input: WalkInput) => MissingEntry[];

export type FixtureDiffRequest = {
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly fixture: unknown;
  readonly requiredOnly: boolean;
};

export type FixtureDiff = {
  readonly schemaName: string;
  readonly dialect: SchemaDialect;
  readonly paths: string[];
  readonly schema: SpecSchema;
  readonly components: SchemaComponents;
};

export type MissingFiles = {
  readonly jsonFile: string;
  readonly typesFile: string;
  readonly stubFile: string;
};
