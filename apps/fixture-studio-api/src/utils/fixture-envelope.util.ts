import { isSchema, resolveSchema } from '@fixture-automation/openapi-fixture-diff';
import type { SpecSchema, SpecSchemas } from '@fixture-automation/openapi-fixture-diff';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { EnvelopeResult } from '../contract/common/studio-api.type.ts';

type ScoredKey = {
  readonly key: string;
  readonly score: number;
};

const isContainer = (value: unknown): boolean => Array.isArray(value) || isRecord(value);

/** An object's keys, or the first element's keys when the value is an array. */
const shapeKeys = (value: unknown): string[] => {
  const shape: unknown = Array.isArray(value) ? value[0] : value;

  if (!isRecord(shape)) return [];

  return Object.keys(shape);
};

const propertyNames = (schema: SpecSchema): string[] => {
  const properties = schema.properties ?? {};

  return Object.keys(properties);
};

/** The payload's top-level property names; an array schema names its items' properties. */
const payloadNames = (schema: SpecSchema, schemas: SpecSchemas): string[] => {
  const resolved = resolveSchema(schema, schemas);
  const { items } = resolved;

  if (!isSchema(items)) return propertyNames(resolved);

  const itemSchema = resolveSchema(items, schemas);

  return propertyNames(itemSchema);
};

const overlap = (value: unknown, names: string[]): number => {
  const keys = shapeKeys(value);
  const matched = keys.filter((key: string): boolean => names.includes(key));

  return matched.length;
};

const scoredKey = (names: string[]): ((entry: [string, unknown]) => ScoredKey) => {
  const score = ([key, value]: [string, unknown]): ScoredKey => {
    const scored: ScoredKey = { key, score: overlap(value, names) };

    return scored;
  };

  return score;
};

const byScore = (first: ScoredKey, second: ScoredKey): number => second.score - first.score;

/**
 * The top-level fixture keys holding an object or array, ranked by how many of the endpoint schema's property names
 * their value (or its first element) carries. `detected` is the best one only when it beats the fixture root itself,
 * so a payload at the root is never mistaken for an envelope.
 */
export const fixtureEnvelope = (spec: OpenApiSpec, schemaName: string, fixture: unknown): EnvelopeResult => {
  const schemas = spec.components?.schemas ?? {};
  const schema = schemas[schemaName];

  if (schema === undefined) throw new Error(`schema "${schemaName}" is unavailable`);

  const none: EnvelopeResult = { candidates: [], detected: undefined };

  if (!isRecord(fixture)) return none;

  const names = payloadNames(schema, schemas);
  const rootScore = overlap(fixture, names);
  const containers = Object.entries(fixture).filter(([, value]: [string, unknown]): boolean => isContainer(value));
  const scored = containers.map(scoredKey(names));
  const ranked = scored.toSorted(byScore);
  const candidates = ranked.map((entry: ScoredKey): string => entry.key);
  const best = ranked[0];
  const isBetter = best !== undefined && best.score > rootScore;
  const detected = isBetter ? best.key : undefined;
  const result: EnvelopeResult = { candidates, detected };

  return result;
};
