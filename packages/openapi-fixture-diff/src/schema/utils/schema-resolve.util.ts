import { FixtureError, referenceName, referenceTarget } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import { isSchema } from './schema-record.util.ts';
import type { SpecSchema, SpecSchemas } from '../common/schema.type.ts';

/** One `resolveSchema` call's resolved `$ref` targets, and the references still being resolved up the stack. */
type ResolveState = {
  readonly resolved: Map<string, SpecSchema>;
  readonly resolving: Set<string>;
};

type ResolveTarget = (target: SpecSchema) => SpecSchema;

const circularReference = (reference: string): FixtureError => {
  return new FixtureError(`circular schema reference "${reference}"`, `break the $ref/allOf cycle through "${reference}" in the spec`);
};

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

/**
 * Follow a `$ref` to the schema `referenceTarget` selects; each target resolves once per call. A reference it leaves to
 * the validator (an unknown anchor, another pointer root) comes back as it is, so a walker treats it as opaque.
 */
const resolveReference = (reference: string, schemas: SpecSchemas, state: ResolveState, resolveTarget: ResolveTarget): SpecSchema => {
  const cached = state.resolved.get(reference);

  if (cached !== undefined) return cached;

  const isResolving = state.resolving.has(reference);

  if (isResolving) throw circularReference(reference);

  const target = referenceTarget(reference, schemas);

  if (target === undefined) {
    const opaque: SpecSchema = { $ref: reference };

    return opaque;
  }

  state.resolving.add(reference);

  const resolved = resolveTarget(target.schema);

  state.resolving.delete(reference);
  state.resolved.set(reference, resolved);

  return resolved;
};

function resolveWith(schema: SpecSchema, schemas: SpecSchemas, state: ResolveState): SpecSchema {
  const reference = schema.$ref;

  if (typeof reference === 'string') {
    const resolveTarget = (target: SpecSchema): SpecSchema => resolveWith(target, schemas, state);

    return resolveReference(reference, schemas, state, resolveTarget);
  }

  const { allOf } = schema;

  if (allOf === undefined) return schema;

  let merged: SpecSchema = { ...schema };

  delete merged.allOf;

  for (const branch of allOf) {
    if (!isSchema(branch)) continue;

    const resolvedBranch = resolveWith(branch, schemas, state);

    merged = mergeInto(merged, resolvedBranch);
  }

  return merged;
}

/**
 * Resolve `$ref` indirection and flatten `allOf` so a walker sees one object schema. A `$ref`'s sibling keywords are
 * ignored; deeper pointers and `$anchor`s resolve too. Each referenced component resolves once per call, so shared `allOf` members stay linear; an unresolved or
 * circular reference fails with a `FixtureError` whose `fix` says what to change in the spec.
 */
export const resolveSchema = (schema: SpecSchema, schemas: SpecSchemas): SpecSchema => {
  const state: ResolveState = { resolved: new Map(), resolving: new Set() };

  return resolveWith(schema, schemas, state);
};

const branchScore = (branch: SpecSchema, value: Record<string, unknown>): number => {
  const keys = Object.keys(branch.properties ?? {});
  const matched = keys.filter((key) => Object.hasOwn(value, key));

  return matched.length;
};

/**
 * Component names reached from `schema` through `$ref` chains and `allOf`/`anyOf`/`oneOf` members.
 * Over-approximates openapi-sampler, which enters only the first anyOf/oneOf member.
 */
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

/**
 * Collapse an absent property's anyOf/oneOf to the single branch the sampler would have picked.
 * Mirrors openapi-sampler, which samples only the first anyOf/oneOf member.
 */
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
