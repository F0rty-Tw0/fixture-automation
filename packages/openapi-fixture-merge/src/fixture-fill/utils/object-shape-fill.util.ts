import { isRecord, selectFixtureShape } from '@fixture-automation/shared';

import { deepFill } from './deep-fill.util.ts';
import type { FillOptions, FillResult } from '../common/fixture-fill.type.ts';

const prefixedFilledPaths = (filled: string[], objectShape: string): string[] => {
  const prefixPath = (path: string): string => {
    const isArrayPath = path.startsWith('[');

    if (!path || isArrayPath) return `${objectShape}${path}`;

    return `${objectShape}.${path}`;
  };
  const prefixed = filled.map(prefixPath);

  return prefixed;
};

/**
 * `deepFill` of `populated` into `corrupt`; with an `objectShape`, only inside that top-level property of both,
 * keeping the corrupt envelope's other keys and prefixing the filled paths with the property name; `options` go to `deepFill`.
 * Throws when either input lacks the property.
 */
export const fillObjectShape = (
  corrupt: unknown,
  populated: unknown,
  objectShape: string | undefined,
  options?: FillOptions
): FillResult => {
  if (objectShape === undefined) return deepFill(corrupt, populated, options);

  const corruptPayload = selectFixtureShape(corrupt, objectShape);
  const populatedPayload = selectFixtureShape(populated, objectShape);
  const mergedPayload = deepFill(corruptPayload, populatedPayload, options);
  const isCorruptEnvelope = isRecord(corrupt);

  if (!isCorruptEnvelope) throw new Error(`fixture has no own property "${objectShape}" for object-shape`);

  const value = { ...corrupt, [objectShape]: mergedPayload.value };
  const filled = prefixedFilledPaths(mergedPayload.filled, objectShape);
  const merged: FillResult = { value, filled };

  return merged;
};
