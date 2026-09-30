import { isRecord } from '@fixture-automation/shared';
import { sample } from 'openapi-sampler';

import { schemaSuggestion } from '../../schema/utils/schema-suggestion.util.ts';
import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';
import type { OpenApiSpec } from '../../shared/openapi-document/common/openapi.type.ts';
import type { FixtureFactory, SampleOptions, SchemaMap } from '../common/fixture-sampling.type.ts';

/** The openapi-sampler value of `components.schemas[name]`, whatever its JSON type; an unknown name fails with a suggestion. */
export const schemaSample = (spec: OpenApiSpec, name: string, options: SampleOptions = {}): unknown => {
  const schemas = spec.components?.schemas ?? {};
  const schema = schemas[name];

  if (!schema) throw new FixtureError(`schema not found: ${name}`, schemaSuggestion(Object.keys(schemas), name));

  return sample(schema, options, spec);
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
    const sampled = schemaSample(spec, name, options);

    if (!isRecord(sampled)) throw new Error(`sample did not produce an object for schema: ${name}`);

    const value = { ...sampled, ...overrides };

    return value;
  };

  return fixture;
}
