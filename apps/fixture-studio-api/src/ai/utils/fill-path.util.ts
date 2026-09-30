import type { MissingFill } from '@fixture-automation/openapi-ai-fixtures';
import { parsePath } from '@fixture-automation/openapi-fixture-diff';
import type { PathToken } from '@fixture-automation/openapi-fixture-diff';
import { isRecord } from '@fixture-automation/shared';

import type { PathValue } from '../common/ai.type.ts';

type Container = MissingFill;

const pointerToken = (token: PathToken): string => {
  const text = String(token);

  return `/${text.replaceAll('~', '~0').replaceAll('/', '~1')}`;
};

const firstIndex = (token: PathToken): PathToken => (typeof token === 'number' ? 0 : token);

const childOf = (node: unknown, token: PathToken): unknown => {
  if (Array.isArray(node)) return typeof token === 'number' ? node[token] : undefined;

  if (!isRecord(node) || typeof token === 'number') return undefined;

  return Object.hasOwn(node, token) ? node[token] : undefined;
};

const valueAtTokens = (value: unknown, tokens: PathToken[]): unknown => {
  let current = value;

  for (const token of tokens) current = childOf(current, token);

  return current;
};

const isContainerFor = (value: unknown, token: PathToken): value is Container => {
  if (typeof token === 'number') return Array.isArray(value);

  return isRecord(value);
};

const emptyContainer = (token: PathToken): Container => {
  if (typeof token === 'number') return [];

  const record: Record<string, unknown> = {};

  return record;
};

/** `value` when it is the container `token` steps into, else a fresh one that replaces it. */
const fittingContainer = (value: unknown, token: PathToken): Container => {
  if (isContainerFor(value, token)) return value;

  return emptyContainer(token);
};

const setChild = (node: Container, token: PathToken, value: unknown): void => {
  if (!Array.isArray(node)) {
    node[String(token)] = value;

    return;
  }

  node[Number(token)] = value;
};

const writeValue = (root: Container, entry: PathValue): void => {
  const tokens = parsePath(entry.path);
  let node: Container = root;

  for (const [position, token] of tokens.entries()) {
    const next = tokens[position + 1];

    if (next === undefined) {
      setChild(node, token, entry.value);

      return;
    }

    const child = childOf(node, token);
    const container = fittingContainer(child, next);

    setChild(node, token, container);
    node = container;
  }
};

/** `lines[2].quantity` as the JSON pointer `/lines/2/quantity` AJV reports. */
export const pathPointer = (path: string): string => {
  const tokens = parsePath(path);

  return tokens.map(pointerToken).join('');
};

/** The value at a diff path, or `undefined` when the path is absent; a parsed JSON value is never `undefined`. */
export const valueAtPath = (value: unknown, path: string): unknown => {
  const tokens = parsePath(path);

  return valueAtTokens(value, tokens);
};

/** The sampler's value for a diff path: the sampler builds one element per array, so every index reads element 0. */
export const sampleAtPath = (sample: unknown, path: string): unknown => {
  const tokens = parsePath(path).map(firstIndex);

  return valueAtTokens(sample, tokens);
};

/**
 * A fresh object, or list when `isList`, holding each value at its path. Array slots no path reaches stay holes: a hole
 * never overwrites another chunk's value when answers merge, and it serializes to `null`, which a merge never lets
 * replace a baseline value, whereas `{}` would replace a primitive or array element there.
 */
export const pathTree = (entries: PathValue[], isList: boolean): MissingFill => {
  const tree = emptyContainer(isList ? 0 : '');

  for (const entry of entries) writeValue(tree, entry);

  return tree;
};
