import type { ValidateFunction } from 'ajv';

export type SchemaDialect = 'draft-07' | 'openapi-30' | 'openapi-31';

export type SchemaAnchorOwner = {
  readonly documentOwners: string[];
  readonly owners: string[];
};

export type SchemaAnchorOwners = Map<string, SchemaAnchorOwner>;

export type PreparedSchema<TFixture = Record<string, unknown>> = {
  readonly context: string;
  readonly validate: ValidateFunction<TFixture>;
};
