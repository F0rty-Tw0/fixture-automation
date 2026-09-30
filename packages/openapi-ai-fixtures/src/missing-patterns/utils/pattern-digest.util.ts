import { isRecord } from '@fixture-automation/shared';

import { baselineContext } from './baseline-context.util.ts';
import type { MissingPattern } from '../common/missing-pattern.type.ts';

const DIGEST_ARRAY_LENGTH = 3;

type DigestEntry = [string, unknown];

/**
 * `value` with every array cut to its first elements.
 * ponytail: the first 3 elements only; a chain entering a later index (`lines[500].notes`) loses its sibling
 * examples. Keep the elements the paths enter too if models guess nested shapes wrong.
 */
function cappedArrays(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, DIGEST_ARRAY_LENGTH).map(cappedArrays);

  if (!isRecord(value)) return value;

  const capEntry = ([key, field]: DigestEntry): DigestEntry => [key, cappedArrays(field)];
  const entries = Object.entries(value).map(capEntry);

  return Object.fromEntries(entries);
}

/**
 * The baseline a model needs to answer `patterns` in house style: `baselineContext` of every pattern path, with every
 * array cut to its first 3 elements so a 1000-element array costs 3 sibling examples. The input is never mutated.
 */
export const patternDigest = (fixture: unknown, patterns: MissingPattern[]): unknown => {
  const paths = patterns.flatMap((pattern: MissingPattern): string[] => pattern.paths);
  const context = baselineContext(fixture, paths);

  return cappedArrays(context);
};
