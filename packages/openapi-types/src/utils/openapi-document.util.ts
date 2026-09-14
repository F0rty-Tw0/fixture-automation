import type { OpenAPI3 } from 'openapi-typescript';

/** Whether `value` is a parsed OpenAPI 3.x document carrying `openapi` and `info`. */
export const isOpenApiDocument = (value: unknown): value is OpenAPI3 => {
  const isRecord = typeof value === 'object' && value !== null;

  if (!isRecord) return false;

  const hasVersion = 'openapi' in value && typeof value.openapi === 'string';
  const hasInfo = 'info' in value && typeof value.info === 'object' && value.info !== null;

  return hasVersion && hasInfo;
};
