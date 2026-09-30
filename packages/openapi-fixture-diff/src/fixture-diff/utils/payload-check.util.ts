import { prepareSchema } from '@fixture-automation/openapi-ai-fixtures';
import type { PreparedSchema } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError, reachableSchemas } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import type { SpecSchema, SpecSchemas } from '../../schema/common/schema.type.ts';
import { isItemList } from '../../schema/utils/schema-list.util.ts';
import { resolveSchema } from '../../schema/utils/schema-resolve.util.ts';
import type { PayloadCheck, SchemaViolation } from '../common/missing.type.ts';

/**
 * Every `$ref` reachable from `schemaName` resolves, and no component reaches itself through `$ref`/`allOf`; each
 * failure is a `FixtureError` with its own fix, raised before the validator compiles or overflows on it.
 */
const assertResolvable = (spec: OpenApiSpec, schemaName: string): void => {
  const schemas = spec.components?.schemas ?? {};
  const schema = schemas[schemaName];

  if (schema === undefined) return;

  const reachable = reachableSchemas(schema, schemas);
  const components = Object.values(reachable);

  for (const component of [schema, ...components]) resolveSchema(component, schemas);
};

/**
 * The compiled schema. An unresolved `$ref` or a `$ref`/`allOf` cycle fails with its own fix; any other spec the
 * validator rejects (bad pattern, empty enum, external `$ref`) fails with a generic one.
 */
export const compiledSchema = (spec: OpenApiSpec, schemaName: string): PreparedSchema => {
  assertResolvable(spec, schemaName);

  try {
    return prepareSchema(spec, schemaName);
  } catch (error: unknown) {
    if (error instanceof FixtureError) throw error;

    if (!(error instanceof Error)) throw error;

    const fix = `fix schema "${schemaName}" in the spec so a JSON Schema validator accepts it`;

    throw new FixtureError(`schema "${schemaName}" cannot be compiled: ${error.message}`, fix);
  }
};

const CIRCULAR_MESSAGE =
  'circular schema reference: a schema reaches itself through anyOf/oneOf/allOf or $ref before reaching any value';
const CIRCULAR_FIX = 'break the cycle in the spec: an anyOf/oneOf/allOf member must not refer back to its own schema directly';

/**
 * AJV's violations of `value`, empty when valid. A validator stack overflow, from a schema that reaches itself without
 * reaching any value (`oneOf: [$ref self, ...]`), fails with the circular-reference `FixtureError` and its fix.
 */
export const schemaViolations = (prepared: PreparedSchema, value: unknown): SchemaViolation[] => {
  try {
    prepared.validate(value);
  } catch (error: unknown) {
    if (!(error instanceof RangeError)) throw error;

    throw new FixtureError(CIRCULAR_MESSAGE, CIRCULAR_FIX);
  }

  return prepared.validate.errors ?? [];
};

const indexedViolation = (index: number): ((violation: SchemaViolation) => SchemaViolation) => {
  const indexed = (violation: SchemaViolation): SchemaViolation => {
    const moved: SchemaViolation = { ...violation, instancePath: `/${index}${violation.instancePath}` };

    return moved;
  };

  return indexed;
};

const elementViolations = (prepared: PreparedSchema): ((element: unknown, index: number) => SchemaViolation[]) => {
  const violationsOf = (element: unknown, index: number): SchemaViolation[] => {
    const violations = schemaViolations(prepared, element);

    return violations.map(indexedViolation(index));
  };

  return violationsOf;
};

/**
 * A list payload held against its item schema (one that neither is nor offers an array member) is walked as an array
 * of it and validated element by element, even when a loose item schema would accept the whole array.
 */
export const payloadCheck = (prepared: PreparedSchema, source: SpecSchema, schemas: SpecSchemas, payload: unknown): PayloadCheck => {
  if (!isItemList(source, schemas, payload)) {
    const payloadViolations = schemaViolations(prepared, payload);
    const single: PayloadCheck = { schema: source, violations: payloadViolations };

    return single;
  }

  const schema: SpecSchema = { type: 'array', items: source };
  const violations = payload.flatMap(elementViolations(prepared));
  const list: PayloadCheck = { schema, violations };

  return list;
};
