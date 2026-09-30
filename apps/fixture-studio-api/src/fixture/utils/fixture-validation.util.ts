import type { PreparedSchema } from '@fixture-automation/openapi-ai-fixtures';
import { compiledSchema, isItemList, schemaViolations } from '@fixture-automation/openapi-fixture-diff';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

type ValidationError = {
  readonly instancePath: string;
  readonly keyword: string;
  readonly message?: string | undefined;
};

const errorLines = (prepared: PreparedSchema, value: unknown, prefix: string): string[] => {
  const errors = schemaViolations(prepared, value);
  const errorLine = (error: ValidationError): string => {
    const path = `${prefix}${error.instancePath}` || '/';
    const message = error.message ?? error.keyword;

    return `${path}: ${message}`;
  };

  return errors.map(errorLine);
};

/**
 * Schema violations of `value` as `path: message` lines, formatted like the merge CLI; empty when valid. A list held
 * against its item schema (one that neither is nor offers an array member) is validated element by element, each path
 * starting at the element's index. A spec the validator cannot compile, an unresolved or circular `$ref`, or a schema
 * that reaches itself before reaching any value fails with a `FixtureError` and a fix.
 */
export const validationErrors = (spec: OpenApiSpec, schemaName: string, value: unknown): string[] => {
  const prepared = compiledSchema(spec, schemaName);
  const schemas = spec.components?.schemas ?? {};
  const schema = schemas[schemaName] ?? {};

  if (!isItemList(schema, schemas, value)) return errorLines(prepared, value, '');

  const elementErrors = (element: unknown, index: number): string[] => errorLines(prepared, element, `/${index}`);

  return value.flatMap(elementErrors);
};
