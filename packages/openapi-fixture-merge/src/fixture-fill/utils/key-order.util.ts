import { isRecord } from '@fixture-automation/shared';

type Entry = [string, unknown];

/**
 * `value` with each object's keys in the order of the matching `reference` object: shared keys first, in reference order,
 * then the keys `reference` lacks, in their current order. Arrays recurse index by index; any other pairing returns `value`.
 * Neither input is mutated.
 */
export function orderLike(value: unknown, reference: unknown): unknown {
  const areArrays = Array.isArray(value) && Array.isArray(reference);

  if (areArrays) return value.map((element, index): unknown => orderLike(element, reference[index]));

  const areRecords = isRecord(value) && isRecord(reference);

  if (!areRecords) return value;

  const entries: Entry[] = [];

  for (const [key, referenceValue] of Object.entries(reference)) {
    const hasKey = Object.hasOwn(value, key);

    if (hasKey) entries.push([key, orderLike(value[key], referenceValue)]);
  }

  for (const [key, element] of Object.entries(value)) {
    const isPlaced = Object.hasOwn(reference, key);

    if (!isPlaced) entries.push([key, element]);
  }

  return Object.fromEntries(entries);
}
