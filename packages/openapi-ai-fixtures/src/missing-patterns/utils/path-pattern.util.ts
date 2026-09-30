import type { MissingPattern } from '../common/missing-pattern.type.ts';

const INDEX = /\[\d+\]/g;

/** The path with every array index written as `[*]`: `a[1].b[0].c` → `a[*].b[*].c`. */
export const pathPattern = (path: string): string => path.replace(INDEX, '[*]');

/** The paths grouped by pattern, patterns in first-seen order and each group's paths in input order. */
export const missingPatterns = (paths: string[]): MissingPattern[] => {
  const groups = new Map<string, string[]>();

  for (const path of paths) {
    const pattern = pathPattern(path);
    const group = groups.get(pattern) ?? [];

    group.push(path);
    groups.set(pattern, group);
  }

  const toPattern = ([pattern, patternPaths]: [string, string[]]): MissingPattern => {
    const missingPattern: MissingPattern = { pattern, paths: patternPaths };

    return missingPattern;
  };

  const entries = [...groups];

  return entries.map(toPattern);
};
