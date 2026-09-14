import type { JSONSchema7 } from 'json-schema';

import { referenceName } from './schema-reference.util.ts';

type SpecSchemas = Record<string, JSONSchema7>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const collectRefs = (value: unknown, names: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, names);

    return;
  }

  if (!isRecord(value)) return;

  const reference = value['$ref'];

  if (typeof reference === 'string') names.add(referenceName(reference));

  for (const [key, child] of Object.entries(value)) {
    const isExtension = key.startsWith('x-');

    if (isExtension) continue;

    collectRefs(child, names);
  }
};

const schemaRefs = (schema: JSONSchema7): Set<string> => {
  const names = new Set<string>();

  collectRefs(schema, names);

  return names;
};

/**
 * The component schemas reachable from `schema` through `$ref`, transitively.
 *
 * A schema that references nothing yields an empty map, which keeps a diff's `missing.json`
 * small enough for the AI step to pass on stdin. A schema cycle terminates on the visited set.
 */
export const reachableSchemas = (schema: JSONSchema7, schemas: SpecSchemas): SpecSchemas => {
  const roots = schemaRefs(schema);
  const pending = [...roots];
  const selected = new Map<string, JSONSchema7>();

  for (const name of pending) {
    const isSelected = selected.has(name);

    if (isSelected) continue;

    const target = schemas[name];

    if (target === undefined) throw new Error(`unresolved schema reference "${name}"`);

    selected.set(name, target);

    for (const next of schemaRefs(target)) pending.push(next);
  }

  return Object.fromEntries(selected);
};
