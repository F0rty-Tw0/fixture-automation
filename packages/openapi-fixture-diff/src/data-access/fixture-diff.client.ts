import { prepareSchema, schemaDialect } from '@fixture-automation/openapi-ai-fixtures';
import type { PreparedSchema } from '@fixture-automation/openapi-ai-fixtures';
import { reachableSchemas } from '@fixture-automation/openapi-fixtures';
import { selectFixtureShape } from '@fixture-automation/shared';

import type {
  BrokenEntry,
  FixtureDiff,
  FixtureDiffRequest,
  MissingEntry,
  ReplaceCandidate,
  ReplaceablePredicate
} from '../common/missing.type.ts';
import type { SchemaComponents, SpecSchema, SpecSchemas } from '../common/schema.type.ts';
import { dropPaths, hasPath } from '../utils/drop-path.util.ts';
import { invalidPaths } from '../utils/invalid-path.util.ts';
import { missingProjection } from '../utils/missing-projection.util.ts';
import { missingEntries } from '../utils/missing-walk.util.ts';
import { isPlaceholderValue } from '../utils/placeholder-value.util.ts';
import { contextComponents } from '../utils/prepared-context.util.ts';

type PathEntry = BrokenEntry | MissingEntry;

/** Why a present value needs a refill, or `undefined` when it is fine. */
type BrokenReason = (candidate: ReplaceCandidate) => string | undefined;

const PLACEHOLDER_REASON = 'openapi-sampler placeholder';

/** The first entry per path: the walk visits a key twice when both a schema and its picked anyOf/oneOf member declare it. */
const uniqueEntries = <TEntry extends PathEntry>(entries: TEntry[]): TEntry[] => {
  const seen = new Set<string>();
  const unique: TEntry[] = [];

  for (const entry of entries) {
    const isSeen = seen.has(entry.path);

    if (isSeen) continue;

    seen.add(entry.path);
    unique.push(entry);
  }

  return unique;
};

const wrappedPath = (objectShape: string, path: string): string => {
  const isArrayPath = path.startsWith('[');

  if (isArrayPath) return `${objectShape}${path}`;

  return `${objectShape}.${path}`;
};

const wrappedProjection = (objectShape: string, projection: SpecSchema): SpecSchema => {
  const properties = { [objectShape]: projection };
  const schema: SpecSchema = {
    type: 'object',
    required: [objectShape],
    properties
  };

  return schema;
};

/**
 * Validates the payload once; a present value is broken when AJV flags it or it is a sampler placeholder.
 * ponytail: AJV reports every failing anyOf/oneOf member, so a value valid in the member the walk picks can still
 * be flagged; that only costs a refill of a value that was already fine.
 */
const brokenReasonIn = (prepared: PreparedSchema, payload: unknown, schemas: SpecSchemas): BrokenReason => {
  prepared.validate(payload);

  const violations = prepared.validate.errors ?? [];
  const invalid = invalidPaths(violations, payload);

  const reasonOf = (candidate: ReplaceCandidate): string | undefined => {
    const message = invalid.get(candidate.path);

    if (message !== undefined) return message;

    const isPlaceholder = isPlaceholderValue(candidate, schemas);

    return isPlaceholder ? PLACEHOLDER_REASON : undefined;
  };

  return reasonOf;
};

/** Records each broken value the walk meets into `broken`; the walk refills it only when `isRefilled`. */
const recordingPredicate = (reasonOf: BrokenReason, broken: BrokenEntry[], isRefilled: boolean): ReplaceablePredicate => {
  const isReplaceable = (candidate: ReplaceCandidate): boolean => {
    const reason = reasonOf(candidate);

    if (reason === undefined) return false;

    const entry: BrokenEntry = { path: candidate.path, value: candidate.value, reason };

    broken.push(entry);

    return isRefilled;
  };

  return isReplaceable;
};

const wrappedBroken = (objectShape: string, entry: BrokenEntry): BrokenEntry => {
  const wrapped: BrokenEntry = { ...entry, path: wrappedPath(objectShape, entry.path) };

  return wrapped;
};

/**
 * Compare a fixture against its schema and project every absent property into one Missing schema.
 * Present values that are schema-invalid or openapi-sampler placeholders are always listed in `broken`; with
 * `replacePlaceholders` they are projected too, and dropped from the returned `baseline` so a fill and merge onto
 * it replaces them.
 *
 * `components` lists only the schemas reachable from that projection, so a diff over a large
 * spec stays small enough to hand to the AI step.
 */
export const diffFixture = (request: FixtureDiffRequest): FixtureDiff => {
  const { spec, schemaName, fixture, requiredOnly, replacePlaceholders, objectShape: objectShapeInput } = request;
  const trimmedShape = objectShapeInput?.trim();
  const objectShape = trimmedShape === '' ? undefined : trimmedShape;
  const selectedFixture = selectFixtureShape(fixture, objectShape);
  const dialect = schemaDialect(spec.openapi, spec.jsonSchemaDialect);
  const prepared = prepareSchema(spec, schemaName);
  const components = contextComponents(prepared.context);
  const sourceSchema = components.schemas[schemaName];

  if (sourceSchema === undefined) throw new Error(`schema "${schemaName}" is unavailable`);

  const reasonOf = brokenReasonIn(prepared, selectedFixture, components.schemas);
  const recorded: BrokenEntry[] = [];
  const isReplaceable = recordingPredicate(reasonOf, recorded, replacePlaceholders === true);
  const walked = missingEntries({
    schema: sourceSchema,
    value: selectedFixture,
    path: '',
    schemas: components.schemas,
    requiredOnly,
    ancestry: [],
    isReplaceable
  });
  const entries = uniqueEntries(walked);
  const innerPaths = entries.map((entry) => entry.path);
  const innerReplaced = innerPaths.filter((path) => hasPath(selectedFixture, path));
  const projection = missingProjection(entries);
  const innerBroken = uniqueEntries(recorded);
  let paths = innerPaths;
  let replaced = innerReplaced;
  let broken = innerBroken;
  let schema = projection;

  if (objectShape !== undefined) {
    paths = innerPaths.map((path) => wrappedPath(objectShape, path));
    replaced = innerReplaced.map((path) => wrappedPath(objectShape, path));
    broken = innerBroken.map((entry) => wrappedBroken(objectShape, entry));
    schema = wrappedProjection(objectShape, projection);
  }

  const schemas = reachableSchemas(projection, components.schemas);
  const reachable: SchemaComponents = { schemas };
  const baseline = dropPaths(fixture, replaced);
  const diff: FixtureDiff = { schemaName, dialect, paths, replaced, broken, schema, components: reachable, baseline };

  return diff;
};
