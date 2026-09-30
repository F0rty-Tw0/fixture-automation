import { FixtureError, schemaSuggestion } from '@fixture-automation/openapi-fixtures';
import { isRecord, parsePath } from '@fixture-automation/shared';
import type { PathToken } from '@fixture-automation/shared';

const assertIndex = (current: unknown, token: number, path: string): unknown[] => {
  const isPresent = Array.isArray(current) && token < current.length;

  if (!isPresent) throw new Error(`unknown fixture path "${path}"`);

  return current;
};

const assertKey = (current: unknown, token: string, path: string): Record<string, unknown> => {
  if (!isRecord(current)) throw new Error(`unknown fixture path "${path}"`);

  const isPresent = Object.hasOwn(current, token);

  if (isPresent) return current;

  const keys = Object.keys(current);
  let fix: string | undefined;

  if (keys.length > 0) fix = schemaSuggestion(keys, token);

  throw new FixtureError(`unknown fixture path "${path}"`, fix);
};

const step = (current: unknown, token: PathToken, path: string): unknown => {
  if (typeof token === 'number') return assertIndex(current, token, path)[token];

  return assertKey(current, token, path)[token];
};

const remove = (current: unknown, token: PathToken, path: string): void => {
  if (typeof token === 'number') {
    assertIndex(current, token, path).splice(token, 1);

    return;
  }

  const owner = assertKey(current, token, path);

  Reflect.deleteProperty(owner, token);
};

const dropPath = (fixture: unknown, path: string): void => {
  const tokens = parsePath(path);
  const last = tokens.at(-1);

  if (last === undefined) throw new Error(`invalid fixture path "${path}"`);

  let current = fixture;

  for (const token of tokens.slice(0, -1)) current = step(current, token, path);

  remove(current, last, path);
};

const NOT_FOUND = Symbol('not found');

const childAt = (current: unknown, token: PathToken): unknown => {
  if (typeof token === 'number') {
    const isElement = Array.isArray(current) && token < current.length;

    if (!isElement) return NOT_FOUND;

    return current[token];
  }

  if (!isRecord(current)) return NOT_FOUND;

  const isKey = Object.hasOwn(current, token);

  if (!isKey) return NOT_FOUND;

  return current[token];
};

/** Whether `path` names a value that exists in `fixture`. */
export const hasPath = (fixture: unknown, path: string): boolean => {
  let current = fixture;

  for (const token of parsePath(path)) {
    current = childAt(current, token);

    if (current === NOT_FOUND) return false;
  }

  return true;
};

/** Deep copy of `fixture` without the listed paths. Unknown paths throw and the input is never mutated. */
export const dropPaths = (fixture: unknown, paths: string[]): unknown => {
  const corrupted: unknown = structuredClone(fixture);

  for (const path of paths) dropPath(corrupted, path);

  return corrupted;
};
