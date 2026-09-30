import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';
import type { MissingFill } from '../common/missing.type.ts';

/** Whether the missing paths start at an index (`[1].id`), so the fixture is a list and so is its fill. */
export const isListFill = (paths: string[]): boolean => paths.some((path: string): boolean => path.startsWith('['));

/** Whether a parsed answer has the fill's shape: a list for a list fill, an object otherwise. */
export const isMissingFill = (value: unknown, isList: boolean): value is MissingFill => {
  if (isList) return Array.isArray(value);

  return isSchemaRecord(value);
};
