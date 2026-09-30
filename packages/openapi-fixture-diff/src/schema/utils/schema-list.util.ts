import { isSchema } from './schema-record.util.ts';
import { resolveSchema } from './schema-resolve.util.ts';
import type { SpecSchema, SpecSchemas } from '../common/schema.type.ts';

const typeNames = (schema: SpecSchema): unknown[] => {
  const { type } = schema;

  if (Array.isArray(type)) return type;

  return [type];
};

const describesArray = (schema: SpecSchema): boolean => {
  const names = typeNames(schema);
  const isArrayType = names.includes('array');

  return isArrayType || schema.items !== undefined;
};

/** Whether `schema` or one of its anyOf/oneOf members (resolved) describes an array. */
const acceptsArray = (schema: SpecSchema, schemas: SpecSchemas): boolean => {
  const isArraySchema = describesArray(schema);

  if (isArraySchema) return true;

  const anyOf = schema.anyOf ?? [];
  const oneOf = schema.oneOf ?? [];
  const branches = [...anyOf, ...oneOf];
  const members = branches.filter(isSchema);
  const resolveMember = (member: SpecSchema): SpecSchema => resolveSchema(member, schemas);
  const resolved = members.map(resolveMember);

  return resolved.some(describesArray);
};

/**
 * Whether `payload` is a list of `schema`'s values: an array held against a schema that does not describe an array,
 * nor has an anyOf/oneOf member that does, as a list endpoint's response names only its item schema.
 */
export const isItemList = (schema: SpecSchema, schemas: SpecSchemas, payload: unknown): payload is unknown[] => {
  if (!Array.isArray(payload)) return false;

  const resolved = resolveSchema(schema, schemas);
  const isArraySchema = acceptsArray(resolved, schemas);

  return !isArraySchema;
};
