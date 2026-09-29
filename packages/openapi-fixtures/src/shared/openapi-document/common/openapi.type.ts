import type { JSONSchema7 } from 'json-schema';

type SpecComponents = {
  readonly schemas?: Record<string, JSONSchema7>;
};

export type OpenApiSpec = {
  readonly openapi?: string;
  readonly info?: Record<string, unknown>;
  readonly jsonSchemaDialect?: string;
  /** Root schema name recorded by `pruneSpec`; later tools default their schema name from it. */
  readonly 'x-root-schema'?: string;
  /** Route table; only read to map a route answer to its response schema. `pruneSpec` drops it. */
  readonly paths?: Record<string, unknown>;
  readonly components?: SpecComponents;
};
