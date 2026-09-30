import { valueAtPath } from '@fixture-automation/openapi-ai-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { MissingFile } from '../../contract/common/studio-api.type.ts';

/** The projection's only root key, e.g. the `objectShape` wrapper a diff puts around the payload. */
const shapeKey = (missing: MissingFile): string | undefined => {
  const { schema } = missing;

  if (!isRecord(schema)) return undefined;

  const properties = schema['properties'];

  if (!isRecord(properties)) return undefined;

  const keys = Object.keys(properties);

  return keys.length === 1 ? keys[0] : undefined;
};

/** The value inside a one-key wrapper such as `{"missing": {...}}`. */
const unwrapped = (answer: unknown): unknown => {
  if (!isRecord(answer)) return undefined;

  const values = Object.values(answer);

  return values.length === 1 ? values[0] : undefined;
};

const wrapped = (key: string, value: unknown): Record<string, unknown> => {
  const wrapper = { [key]: value };

  return wrapper;
};

const shapeVariants = (answer: unknown, missing: MissingFile): unknown[] => {
  const key = shapeKey(missing);
  const inner = unwrapped(answer);
  const variants = [answer];

  if (inner !== undefined) variants.push(inner);

  if (key === undefined) return variants;

  const outers = variants.map((variant: unknown): Record<string, unknown> => wrapped(key, variant));

  return [...variants, ...outers];
};

const presentCount = (answer: unknown, paths: string[]): number => {
  const present = paths.filter((path: string): boolean => valueAtPath(answer, path) !== undefined);

  return present.length;
};

/**
 * The answer reshaped to the projection's root: unwrapped from a one-key wrapper (`missing`, `data`, `result`, ...),
 * wrapped in the projection's only root key, or both, whichever holds the most missing paths. The answer as it came
 * wins a tie, so a well-shaped answer is never reshaped.
 */
export const normalizedAnswer = (answer: unknown, missing: MissingFile): unknown => {
  let best = answer;
  let bestCount = presentCount(answer, missing.paths);

  for (const variant of shapeVariants(answer, missing)) {
    const count = presentCount(variant, missing.paths);

    if (count <= bestCount) continue;

    best = variant;
    bestCount = count;
  }

  return best;
};
