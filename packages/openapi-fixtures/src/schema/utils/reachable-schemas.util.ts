import { isRecord } from '@fixture-automation/shared';
import type { JSONSchema7 } from 'json-schema';

import { referenceTarget } from './reference-target.util.ts';

type SpecSchemas = Record<string, JSONSchema7>;

const collectRefs = (value: unknown, references: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, references);

    return;
  }

  if (!isRecord(value)) return;

  const reference = value['$ref'];

  if (typeof reference === 'string') references.add(reference);

  for (const [key, child] of Object.entries(value)) {
    const isExtension = key.startsWith('x-');

    if (isExtension) continue;

    collectRefs(child, references);
  }
};

const schemaRefs = (schema: JSONSchema7): Set<string> => {
  const references = new Set<string>();

  collectRefs(schema, references);

  return references;
};

/**
 * The component schemas reachable from `schema` through `$ref`, transitively; a deeper pointer or an `$anchor`
 * reaches the whole component it lands in.
 *
 * A schema that references nothing yields an empty map, which keeps a diff's `missing.json`
 * small enough for the AI step to pass on stdin. A schema cycle terminates on the visited set.
 * A pointer to an undeclared component fails with a `FixtureError` whose fix names it; a reference `referenceTarget`
 * leaves to the validator is skipped.
 */
export const reachableSchemas = (schema: JSONSchema7, schemas: SpecSchemas): SpecSchemas => {
  const roots = schemaRefs(schema);
  const pending = [...roots];
  const selected = new Map<string, JSONSchema7>();

  for (const reference of pending) {
    const target = referenceTarget(reference, schemas);

    if (target === undefined) continue;

    const isSelected = selected.has(target.component);

    if (isSelected) continue;

    selected.set(target.component, target.componentSchema);

    for (const next of schemaRefs(target.componentSchema)) pending.push(next);
  }

  return Object.fromEntries(selected);
};
