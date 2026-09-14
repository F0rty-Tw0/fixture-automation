import { referenceName } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import { isSchema } from './schema-record.util.ts';
import type { SpecSchema, SpecSchemas } from '../common/schema.type.ts';

/** Follow `#/components/schemas/<name>` pointers, decoding the escaped name segment. */
const resolveRef = (schema: SpecSchema, schemas: SpecSchemas): SpecSchema => {
  const seen = new Set<string>();
  let current = schema;

  while (typeof current.$ref === 'string') {
    const reference = current.$ref;
    const isSeen = seen.has(reference);

    if (isSeen) throw new Error(`circular schema reference "${reference}"`);

    seen.add(reference);

    const target = schemas[referenceName(reference)];

    if (target === undefined) throw new Error(`unresolved schema reference "${reference}"`);

    current = target;
  }

  return current;
};

// ponytail: allOf merges properties, required and the remaining keywords; add smarter unions when a spec needs them.
const mergeInto = (base: SpecSchema, extra: SpecSchema): SpecSchema => {
  const merged: SpecSchema = { ...base, ...extra };
  const properties = { ...base.properties, ...extra.properties };
  const baseRequired = base.required ?? [];
  const extraRequired = extra.required ?? [];
  const required = new Set([...baseRequired, ...extraRequired]);
  const hasProperties = base.properties !== undefined || extra.properties !== undefined;
  const hasRequired = base.required !== undefined || extra.required !== undefined;

  delete merged.allOf;

  if (hasProperties) merged.properties = properties;

  if (hasRequired) merged.required = [...required];

  return merged;
};

/** Resolve `$ref` indirection and flatten `allOf` so a walker sees one object schema. */
export const resolveSchema = (schema: SpecSchema, schemas: SpecSchemas): SpecSchema => {
  const resolved = resolveRef(schema, schemas);
  const { allOf } = resolved;

  if (allOf === undefined) return resolved;

  let merged: SpecSchema = { ...resolved };

  delete merged.allOf;

  for (const branch of allOf) {
    if (!isSchema(branch)) continue;

    const resolvedBranch = resolveSchema(branch, schemas);

    merged = mergeInto(merged, resolvedBranch);
  }

  return merged;
};

const branchScore = (branch: SpecSchema, value: Record<string, unknown>): number => {
  const keys = Object.keys(branch.properties ?? {});
  const matched = keys.filter((key) => Object.hasOwn(value, key));

  return matched.length;
};

// ponytail: over-approximates the sampler, which enters only the first anyOf/oneOf member.
/** Component names reached from `schema` through `$ref` chains and `allOf`/`anyOf`/`oneOf` members. */
export const referencedNames = (schema: SpecSchema, schemas: SpecSchemas): string[] => {
  const seen = new Set<string>();
  const names: string[] = [];

  const visit = (current: SpecSchema): void => {
    if (typeof current.$ref === 'string') {
      let name: string;

      try {
        name = referenceName(current.$ref);
      } catch {
        return;
      }

      const isSeen = seen.has(name);

      if (isSeen) return;

      seen.add(name);
      names.push(name);

      const target = schemas[name];

      if (target !== undefined) visit(target);

      return;
    }

    const allOf = current.allOf ?? [];
    const anyOf = current.anyOf ?? [];
    const oneOf = current.oneOf ?? [];
    const branches = [...allOf, ...anyOf, ...oneOf];

    for (const branch of branches) {
      if (isSchema(branch)) visit(branch);
    }
  };

  visit(schema);

  return names;
};

// ponytail: mirrors openapi-sampler, which samples only the first anyOf/oneOf member.
/** Collapse an absent property's anyOf/oneOf to the single branch the sampler would have picked. */
export const firstBranch = (schema: SpecSchema): SpecSchema => {
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const collapsed: SpecSchema = { ...schema, anyOf: schema.anyOf.slice(0, 1) };

    return collapsed;
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const collapsed: SpecSchema = { ...schema, oneOf: schema.oneOf.slice(0, 1) };

    return collapsed;
  }

  return schema;
};

/** Pick the anyOf/oneOf member that best explains an object value; primitive values never miss fields. */
export const pickBranch = (schema: SpecSchema, value: unknown, schemas: SpecSchemas): SpecSchema | undefined => {
  const branches = schema.anyOf ?? schema.oneOf;

  if (branches === undefined) return undefined;

  if (!isRecord(value)) return undefined;

  const resolved = branches.filter(isSchema).map((branch) => resolveSchema(branch, schemas));
  const candidates = resolved.filter((branch) => branch.properties !== undefined);
  let best = candidates[0];
  let bestScore = 0;

  for (const branch of candidates) {
    const score = branchScore(branch, value);

    if (score > bestScore) {
      bestScore = score;
      best = branch;
    }
  }

  return best;
};
