import type { MissingFill } from '@fixture-automation/openapi-ai-fixtures';
import { isRecord } from '@fixture-automation/shared';

type ValueMerge = (first: unknown, second: unknown) => unknown;

const mergedRecord = (first: Record<string, unknown>, second: Record<string, unknown>, merge: ValueMerge): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...first };

  for (const [key, value] of Object.entries(second)) merged[key] = merge(first[key], value);

  return merged;
};

function mergedValue(first: unknown, second: unknown): unknown {
  if (second === undefined) return first;

  if (Array.isArray(first) && Array.isArray(second)) {
    const length = Math.max(first.length, second.length);
    const mergeAt = (_item: unknown, index: number): unknown => mergedValue(first[index], second[index]);

    return Array.from({ length }, mergeAt);
  }

  if (!isRecord(first) || !isRecord(second)) return second;

  return mergedRecord(first, second, mergedValue);
}

/**
 * Combines the answers to two chunks of one fill: objects key by key, arrays index by index (the way `merge` reads
 * them), and for anything else the later answer wins. Chunks cover different paths, so real collisions don't happen.
 * A list fill merges with a list; an empty object, the start of a chunked run, gives way to a list.
 */
export const mergeAnswers = (first: MissingFill, second: MissingFill): MissingFill => {
  const merged = mergedValue(first, second);
  const isFill = Array.isArray(merged) || isRecord(merged);

  if (!isFill) return second;

  return merged;
};
