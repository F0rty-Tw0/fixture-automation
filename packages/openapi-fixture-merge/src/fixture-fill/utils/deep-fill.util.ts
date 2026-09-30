import { isRecord } from '@fixture-automation/shared';

import type { FillOptions, FillResult } from '../common/fixture-fill.type.ts';

type FillContext = {
  readonly filled: string[];
  readonly keepPresent: boolean;
};

const REPLACING: FillOptions = { keepPresent: false };

const childPath = (path: string, key: string): string => {
  if (!path) return key;

  return `${path}.${key}`;
};

const indexPath = (path: string, index: number): string => {
  return `${path}[${index}]`;
};

const jsonType = (value: unknown): string => {
  if (value === null) return 'null';

  if (Array.isArray(value)) return 'array';

  return typeof value;
};

const isCasingFix = (base: unknown, fill: unknown): boolean => {
  const areStrings = typeof base === 'string' && typeof fill === 'string';

  if (!areStrings) return false;

  return base !== fill && base.toLowerCase() === fill.toLowerCase();
};

/** A null on either side, or an absent fill (an array hole or an undefined value), is never a type change. */
const isTypeUpgrade = (base: unknown, fill: unknown): boolean => {
  const hasNull = base === null || fill === null;
  const isAbsent = fill === undefined;

  if (hasNull || isAbsent) return false;

  return jsonType(base) !== jsonType(fill);
};

const fillScalar = (base: unknown, fill: unknown, path: string, context: FillContext): unknown => {
  if (context.keepPresent) return base;

  const isUpgrade = isTypeUpgrade(base, fill);
  const isRecased = isCasingFix(base, fill);
  const isReplaced = isUpgrade || isRecased;

  if (!isReplaced) return base;

  context.filled.push(path);

  return fill;
};

const isAbsentElement = (element: unknown): boolean => element === undefined;

/**
 * The fill elements past the end of `base`, recorded as filled; none with `keepPresent`. Appending stops at the first
 * hole or undefined element and drops the rest, so each appended element keeps its fill index and none becomes `null`.
 */
const appendedElements = (base: unknown[], fill: unknown[], path: string, context: FillContext): unknown[] => {
  const end = context.keepPresent ? base.length : fill.length;
  const tail = fill.slice(base.length, end);
  const absentAt = tail.findIndex(isAbsentElement);
  const stop = absentAt === -1 ? tail.length : absentAt;
  const appended = tail.slice(0, stop);

  for (const offset of appended.keys()) context.filled.push(indexPath(path, base.length + offset));

  return appended;
};

function fillValue(base: unknown, fill: unknown, path: string, context: FillContext): unknown {
  const isArrayMerge = Array.isArray(base) && Array.isArray(fill);

  if (isArrayMerge) {
    const zipped: unknown[] = [];

    for (const [index, element] of base.entries()) {
      const hasFill = index < fill.length;

      if (hasFill) zipped.push(fillValue(element, fill[index], indexPath(path, index), context));
      else zipped.push(element);
    }

    const appended = appendedElements(base, fill, path, context);

    zipped.push(...appended);

    return zipped;
  }

  const isObjectMerge = isRecord(base) && isRecord(fill);

  if (!isObjectMerge) return fillScalar(base, fill, path, context);

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(fill)) {
    if (value === undefined) continue;

    const target = childPath(path, key);
    const hasKey = Object.hasOwn(base, key);

    if (hasKey) {
      merged[key] = fillValue(base[key], value, target, context);
    } else {
      merged[key] = value;
      context.filled.push(target);
    }
  }

  return merged;
}

/**
 * Copy values from `fill` into keys that `base` does not already have, recursing into objects and arrays.
 * A fill value also replaces a baseline scalar when their JSON types differ (neither null) or when two strings differ only
 * in casing, and a shorter baseline array gains the fill's extra elements up to the first hole or undefined one; an
 * array hole or undefined fill value is skipped; `options.keepPresent` turns off replacing and appending, so every
 * present value (an empty array included) is left as it is.
 */
export const deepFill = (base: unknown, fill: unknown, options: FillOptions = REPLACING): FillResult => {
  const filled: string[] = [];
  const context: FillContext = { filled, keepPresent: options.keepPresent };
  const value = fillValue(base, fill, '', context);
  const result: FillResult = { value, filled };

  return result;
};
