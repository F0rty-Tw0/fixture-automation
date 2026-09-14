import type { JSONSchema7 } from 'json-schema';
import type { Options } from 'openapi-sampler';

export type SampleOptions = Options;

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

/** Which schema a CLI samples and where it writes, once the positionals are resolved against the spec. */
export type SchemaTarget = {
  readonly schemaName: string;
  readonly outFile: string | undefined;
};

export type SchemaMap = {
  readonly schemas: Record<string, unknown>;
};

export type FixtureFactory<TComponents extends SchemaMap = SchemaMap> = <TSchemaName extends keyof TComponents['schemas'] & string>(
  name: TSchemaName,
  overrides?: Partial<TComponents['schemas'][TSchemaName]>
) => TComponents['schemas'][TSchemaName];
