import type { MissingViolation } from '@fixture-automation/openapi-ai-fixtures';

import { pathPointer } from './fill-path.util.ts';

type MissingPointer = {
  readonly path: string;
  readonly pointer: string;
};

/** `if` reports its failed `then`/`else` at the parent; the branch's own errors already point at the offending value. */
const IGNORED_KEYWORDS = ['if'];
/** Keywords that name the offending key in a parameter rather than in `instancePath`. */
const KEY_PARAMS = ['missingProperty', 'additionalProperty'];

const isWithin = (pointer: string, ancestor: string): boolean => {
  return pointer === ancestor || pointer.startsWith(`${ancestor}/`);
};

const escapedKey = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1');

const errorPointer = (error: MissingViolation): string => {
  for (const name of KEY_PARAMS) {
    const key = error.params[name];

    if (typeof key === 'string') return `${error.instancePath}/${escapedKey(key)}`;
  }

  return error.instancePath;
};

const isLocated = (error: MissingViolation): boolean => !IGNORED_KEYWORDS.includes(error.keyword);

/** The nearest missing path enclosing `pointer`, else every missing path below it. */
const pathsFor = (pointer: string, missing: MissingPointer[]): string[] => {
  const enclosing = missing.filter((entry: MissingPointer): boolean => isWithin(pointer, entry.pointer));
  const nearestFirst = enclosing.toSorted((first, second): number => second.pointer.length - first.pointer.length);
  const nearest = nearestFirst[0];

  if (nearest !== undefined) return [nearest.path];

  const below = missing.filter((entry: MissingPointer): boolean => isWithin(entry.pointer, pointer));

  return below.map((entry: MissingPointer): string => entry.path);
};

const missingPointer = (path: string): MissingPointer => {
  const entry: MissingPointer = { path, pointer: pathPointer(path) };

  return entry;
};

/**
 * The missing paths an AJV verdict rejects, in `paths` order. A `required` or `additionalProperties` error points at
 * the key it names, and an `if` error is skipped for its branch's errors; each error flags the nearest missing path
 * enclosing it, or every missing path below it. An error touching no missing path, such as a
 * sibling key the projection requires but the baseline already has, flags nothing.
 */
export const violatedPaths = (errors: MissingViolation[], paths: string[]): Set<string> => {
  const missing = paths.map(missingPointer);
  const flagged = new Set<string>();

  for (const error of errors.filter(isLocated)) {
    const pointer = errorPointer(error);

    for (const path of pathsFor(pointer, missing)) flagged.add(path);
  }

  const ordered = paths.filter((path: string): boolean => flagged.has(path));

  return new Set(ordered);
};
