import { isRecord } from '../../shared/json/utils/record.util.ts';

/**
 * Combines the answers to two chunks of one fill: objects key by key, arrays index by index (the way `merge` reads
 * them), and for anything else the later answer wins. Chunks cover different paths, so real collisions don't happen.
 */
export function mergeAnswers(first: unknown, second: unknown): unknown {
  if (second === undefined) return first;

  if (Array.isArray(first) && Array.isArray(second)) {
    const length = Math.max(first.length, second.length);
    const mergeAt = (_item: unknown, index: number): unknown => mergeAnswers(first[index], second[index]);

    return Array.from({ length }, mergeAt);
  }

  if (!isRecord(first) || !isRecord(second)) return second;

  const merged: Record<string, unknown> = { ...first };

  for (const [key, value] of Object.entries(second)) merged[key] = mergeAnswers(first[key], value);

  return merged;
}
