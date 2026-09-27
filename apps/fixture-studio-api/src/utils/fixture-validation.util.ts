import { prepareSchema } from '@fixture-automation/openapi-ai-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

type ValidationError = {
  readonly instancePath: string;
  readonly keyword: string;
  readonly message?: string | undefined;
};

const errorLine = (error: ValidationError): string => {
  const path = error.instancePath || '/';
  const message = error.message ?? error.keyword;

  return `${path}: ${message}`;
};

/** Schema violations of `value` as `path: message` lines, formatted like the merge CLI; empty when valid. */
export const validationErrors = (spec: OpenApiSpec, schemaName: string, value: unknown): string[] => {
  const prepared = prepareSchema(spec, schemaName);
  const isValid = prepared.validate(value);

  if (isValid) return [];

  const errors = prepared.validate.errors ?? [];

  return errors.map(errorLine);
};
