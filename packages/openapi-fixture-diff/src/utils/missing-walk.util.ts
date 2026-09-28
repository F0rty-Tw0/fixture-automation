import { isRecord } from '@fixture-automation/shared';

import { isSchema } from './schema-record.util.ts';
import { firstBranch, pickBranch, referencedNames, resolveSchema } from './schema-resolve.util.ts';
import type { MissingEntry, ReplaceCandidate, WalkFunction, WalkInput } from '../common/missing.type.ts';
import type { SpecSchema } from '../common/schema.type.ts';

const childPath = (path: string, key: string): string => {
  if (!path) return key;

  return `${path}.${key}`;
};

/** An absent key, or a present value the caller wants refilled rather than walked. */
const isRefilled = (owner: Record<string, unknown>, candidate: ReplaceCandidate, input: WalkInput): boolean => {
  const isPresent = Object.hasOwn(owner, candidate.key);

  if (!isPresent) return true;

  return input.isReplaceable(candidate);
};

const propertyEntries = (source: SpecSchema, value: Record<string, unknown>, input: WalkInput, walk: WalkFunction): MissingEntry[] => {
  const properties = source.properties ?? {};
  const required = source.required ?? [];
  const entries: MissingEntry[] = [];

  for (const [key, definition] of Object.entries(properties)) {
    const isRequired = required.includes(key);
    const isSkipped = input.requiredOnly && !isRequired;

    if (isSkipped || !isSchema(definition)) continue;

    const names = referencedNames(definition, input.schemas);
    const isCycle = names.some((name) => input.ancestry.includes(name));

    if (isCycle) continue;

    const path = childPath(input.path, key);
    const candidate: ReplaceCandidate = { path, key, schema: definition, value: value[key] };
    const isMissing = isRefilled(value, candidate, input);

    if (isMissing) {
      entries.push({ path, schema: firstBranch(definition) });
      continue;
    }

    const ancestry = [...input.ancestry, ...names];
    const next: WalkInput = { ...input, schema: definition, value: value[key], path, ancestry };
    const found = walk(next);

    entries.push(...found);
  }

  return entries;
};

const itemEntries = (schema: SpecSchema, value: unknown[], input: WalkInput, walk: WalkFunction): MissingEntry[] => {
  const { items } = schema;
  const entries: MissingEntry[] = [];

  if (!isSchema(items)) return entries;

  const names = referencedNames(items, input.schemas);
  const isCycle = names.some((name) => input.ancestry.includes(name));

  if (isCycle) return entries;

  const ancestry = [...input.ancestry, ...names];

  for (const [index, item] of value.entries()) {
    const path = `${input.path}[${index}]`;
    const next: WalkInput = { ...input, schema: items, value: item, path, ancestry };
    const found = walk(next);

    entries.push(...found);
  }

  return entries;
};

/**
 * Every schema property absent from `value`, recorded with its whole sub-schema.
 *
 * Recursion only descends into values that are present, so a fixture that bottomed out at a
 * schema cycle (`{}`) reports all of that object's properties as missing and then terminates.
 * A property whose schema is already being expanded up the path — its component name is in
 * `ancestry` — terminates the same way the `openapi-sampler` does: it is neither walked nor
 * reported missing. `additionalProperties` and `patternProperties` are ignored.
 *
 * A present property value that `isReplaceable` flags is reported like an absent one and never entered.
 */
export const missingEntries = (input: WalkInput): MissingEntry[] => {
  const schema = resolveSchema(input.schema, input.schemas);
  const { value } = input;

  if (Array.isArray(value)) return itemEntries(schema, value, input, missingEntries);

  if (!isRecord(value)) return [];

  const entries = propertyEntries(schema, value, input, missingEntries);
  const branch = pickBranch(schema, value, input.schemas);

  if (branch === undefined) return entries;

  const branchEntries = propertyEntries(branch, value, input, missingEntries);

  entries.push(...branchEntries);

  return entries;
};
