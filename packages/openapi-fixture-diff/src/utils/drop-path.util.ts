import { FixtureError, schemaSuggestion } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { PathToken } from '../common/path.type.ts';

const SEGMENT = /^([^.[\]]+)((?:\[\d+\])*)$/;
const INDEX = /\[(\d+)\]/g;

/** Split `lines.data[0].id` into its object keys and array indices. */
export const parsePath = (path: string): PathToken[] => {
  const tokens: PathToken[] = [];

  for (const segment of path.split('.')) {
    const match = SEGMENT.exec(segment);
    const key = match?.[1];
    const indexes = match?.[2];

    if (key === undefined || indexes === undefined) throw new Error(`invalid fixture path "${path}"`);

    tokens.push(key);

    for (const index of indexes.matchAll(INDEX)) tokens.push(Number(index[1]));
  }

  return tokens;
};

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

/** Deep copy of `fixture` without the listed paths. Unknown paths throw and the input is never mutated. */
export const dropPaths = (fixture: unknown, paths: string[]): unknown => {
  const corrupted: unknown = structuredClone(fixture);

  for (const path of paths) dropPath(corrupted, path);

  return corrupted;
};
