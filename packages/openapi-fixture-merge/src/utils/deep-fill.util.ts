import { isRecord } from '@fixture-automation/shared';

import type { FillResult } from '../common/fixture-merge.type.ts';

const childPath = (path: string, key: string): string => {
  if (!path) return key;

  return `${path}.${key}`;
};

const indexPath = (path: string, index: number): string => {
  return `${path}[${index}]`;
};

// ponytail: index-zip; keyed merge if ids matter
function fillValue(base: unknown, fill: unknown, path: string, filled: string[]): unknown {
  const isArrayMerge = Array.isArray(base) && Array.isArray(fill);

  if (isArrayMerge) {
    const zipped: unknown[] = [];

    for (const [index, element] of base.entries()) {
      const hasFill = index < fill.length;

      if (hasFill) zipped.push(fillValue(element, fill[index], indexPath(path, index), filled));
      else zipped.push(element);
    }

    for (let index = base.length; index < fill.length; index += 1) {
      zipped.push(fill[index]);
      filled.push(indexPath(path, index));
    }

    return zipped;
  }

  const isObjectMerge = isRecord(base) && isRecord(fill);

  if (!isObjectMerge) return base;

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(fill)) {
    const target = childPath(path, key);
    const hasKey = Object.hasOwn(base, key);

    if (hasKey) {
      merged[key] = fillValue(base[key], value, target, filled);
    } else {
      merged[key] = value;
      filled.push(target);
    }
  }

  return merged;
}

/** Copy values from `fill` into keys that `base` does not already have, recursing into objects and arrays. */
export const deepFill = (base: unknown, fill: unknown): FillResult => {
  const filled: string[] = [];
  const value = fillValue(base, fill, '', filled);
  const result: FillResult = { value, filled };

  return result;
};
