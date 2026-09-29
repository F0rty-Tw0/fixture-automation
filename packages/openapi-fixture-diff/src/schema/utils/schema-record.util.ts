import { isRecord } from '@fixture-automation/shared';

import type { SpecSchema } from '../common/schema.type.ts';

/** JSON Schema positions also accept booleans and tuples; only object schemas carry keywords to walk. */
export const isSchema = (value: unknown): value is SpecSchema => {
  return isRecord(value);
};
