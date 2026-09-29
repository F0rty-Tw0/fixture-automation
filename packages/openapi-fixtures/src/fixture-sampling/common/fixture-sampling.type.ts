import type { Options } from 'openapi-sampler';

export type SampleOptions = Options;

export type SchemaMap = {
  readonly schemas: Record<string, unknown>;
};

export type FixtureFactory<TComponents extends SchemaMap = SchemaMap> = <TSchemaName extends keyof TComponents['schemas'] & string>(
  name: TSchemaName,
  overrides?: Partial<TComponents['schemas'][TSchemaName]>
) => TComponents['schemas'][TSchemaName];
