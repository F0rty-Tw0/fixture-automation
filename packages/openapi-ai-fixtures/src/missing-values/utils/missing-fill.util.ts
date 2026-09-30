import { pathTree, valueAtPath } from './path-tree.util.ts';
import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';
import type { MissingFill, PathValue } from '../common/missing.type.ts';

/** Whether the missing paths start at an index (`[1].id`), so the fixture is a list and so is its fill. */
export const isListFill = (paths: string[]): boolean => paths.some((path: string): boolean => path.startsWith('['));

/** Whether a parsed answer has the fill's shape: a list for a list fill, an object otherwise. */
export const isMissingFill = (value: unknown, isList: boolean): value is MissingFill => {
  if (isList) return Array.isArray(value);

  return isSchemaRecord(value);
};

const pathValueIn = (value: unknown, path: string): PathValue => {
  const entry: PathValue = { path, value: valueAtPath(value, path) };

  return entry;
};

const isPresent = (entry: PathValue): boolean => entry.value !== undefined;

/**
 * `value` trimmed to the values at `paths`: a key or item the diff never reported, which the projection check ignores
 * when it touches no missing path, never reaches the merge that writes the fill over the baseline.
 */
export const missingOnly = (value: unknown, paths: string[]): MissingFill => {
  const entries = paths.map((path: string): PathValue => pathValueIn(value, path));
  const present = entries.filter(isPresent);

  return pathTree(present, isListFill(paths));
};
