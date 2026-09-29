import { isRecord } from '@fixture-automation/shared';
import type { OpenAPI3 } from 'openapi-typescript';

/** Whether `value` is a parsed OpenAPI 3.x document carrying `openapi` and `info`. */
export const isOpenApiDocument = (value: unknown): value is OpenAPI3 => {
  if (!isRecord(value)) return false;

  const hasVersion = typeof value['openapi'] === 'string';
  const hasInfo = typeof value['info'] === 'object' && value['info'] !== null;

  return hasVersion && hasInfo;
};
