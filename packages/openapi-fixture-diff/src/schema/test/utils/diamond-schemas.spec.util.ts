import type { SpecSchema, SpecSchemas } from '../../common/schema.type.ts';

const levelReference = (level: number): SpecSchema => {
  const reference: SpecSchema = { $ref: `#/components/schemas/level${level}` };

  return reference;
};

/** `level<i>` is `allOf: [level<i+1>, level<i+1>]` down to an object `level<depth>`: 2^depth paths without memoization. */
export const diamondSchemas = (depth: number): SpecSchemas => {
  const name: SpecSchema = { type: 'string' };
  const properties = { name };
  const bottom: SpecSchema = { type: 'object', properties };
  const schemas: SpecSchemas = { [`level${depth}`]: bottom };

  for (let level = 0; level < depth; level += 1) {
    const next = levelReference(level + 1);

    schemas[`level${level}`] = { allOf: [next, next] };
  }

  return schemas;
};

/** `schemas` behind a proxy that counts each component lookup by name into `lookups`. */
export const countedSchemas = (schemas: SpecSchemas, lookups: Map<string, number>): SpecSchemas => {
  const handler: ProxyHandler<SpecSchemas> = {
    get: (target: SpecSchemas, name: string | symbol): unknown => {
      if (typeof name === 'string') lookups.set(name, (lookups.get(name) ?? 0) + 1);

      return Reflect.get(target, name);
    }
  };

  return new Proxy(schemas, handler);
};
