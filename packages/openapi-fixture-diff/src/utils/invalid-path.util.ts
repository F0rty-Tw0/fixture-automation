import { isRecord } from '@fixture-automation/shared';

import type { SchemaViolation } from '../common/missing.type.ts';

/** Keywords that wrap or group other errors, or report absent keys the walk already lists; only leaf keywords flag a value. */
const WRAPPER_KEYWORDS = ['required', 'anyOf', 'oneOf', 'additionalProperties', 'unevaluatedProperties', 'if', 'then', 'else', 'not'];
const TRAILING_INDEXES = /(?:\[\d+\])+$/;

const unescapeToken = (token: string): string => {
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
};

const joinedPath = (path: string, token: string, isIndex: boolean): string => {
  if (isIndex) return `${path}[${token}]`;

  if (!path) return token;

  return `${path}.${token}`;
};

const childValue = (current: unknown, token: string): unknown => {
  if (Array.isArray(current)) return current[Number(token)];

  if (isRecord(current)) return current[token];

  return undefined;
};

/** `/lines/0/sku` into the diff's `lines[0].sku`; the value decides whether a numeric token is an index or a key. */
const pointerPath = (pointer: string, value: unknown): string => {
  const tokens = pointer.split('/').slice(1).map(unescapeToken);
  let path = '';
  let current = value;

  for (const token of tokens) {
    const isIndex = Array.isArray(current);

    path = joinedPath(path, token, isIndex);
    current = childValue(current, token);
  }

  return path;
};

/**
 * The property paths holding a schema-invalid value. An invalid primitive array element flags its enclosing
 * property, since dropping one element would shift the indices a merge zips by; the payload root is never flagged.
 */
export const invalidPaths = (violations: SchemaViolation[], value: unknown): Set<string> => {
  const paths = new Set<string>();

  for (const violation of violations) {
    const isWrapper = WRAPPER_KEYWORDS.includes(violation.keyword);

    if (isWrapper) continue;

    const pointed = pointerPath(violation.instancePath, value);
    const path = pointed.replace(TRAILING_INDEXES, '');

    if (path) paths.add(path);
  }

  return paths;
};
