import { sample } from 'openapi-sampler';

import { FixtureError } from '../common/fixture.error.ts';
import type { FixtureFactory, OpenApiSpec, SampleOptions, SchemaMap } from '../common/openapi.type.ts';
import { schemaSuggestion } from '../utils/schema-suggestion.util.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

/**
 * Deterministic fixtures from `components.schemas`. Pass the generated `components` type:
 *   const fx = fixtures<components>(spec);
 *   const invoice = fx('invoice', { amount_due: 100 }); // typed as components['schemas']['invoice']
 * { skipNonRequired: true } → only required fields; needed when a *required* property sits on a schema cycle
 */
export function fixtures<TComponents extends SchemaMap = SchemaMap>(
  spec: OpenApiSpec,
  options?: SampleOptions
): FixtureFactory<TComponents>;

export function fixtures(spec: OpenApiSpec, options: SampleOptions = {}): FixtureFactory {
  const fixture: FixtureFactory = (name, overrides = {}): Record<string, unknown> => {
    const schemas = spec.components?.schemas ?? {};
    const schema = schemas[name];

    if (!schema) throw new FixtureError(`schema not found: ${name}`, schemaSuggestion(Object.keys(schemas), name));

    const sampled = sample(schema, options, spec);

    if (!isRecord(sampled)) throw new Error(`sample did not produce an object for schema: ${name}`);

    const value = { ...sampled, ...overrides };

    return value;
  };

  return fixture;
}
