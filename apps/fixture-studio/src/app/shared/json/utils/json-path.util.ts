import { isRecord } from './record.util.ts';
import type { JsonContainer } from '../common/json.type.ts';

const DOTTED_SEGMENT = /[^.[\]]+/gu;
const INDEX = /^\d+$/u;
/** Merge errors name the root `/` (the API's `instancePath || '/'`), not the key `""` as RFC 6901 would. */
const ROOT_POINTER = '/';

const unescapePointer = (segment: string): string => segment.replaceAll('~1', '/').replaceAll('~0', '~');

/**
 * The keys along a fixture path: the diff's dotted form (`lines[0].sku`) or a JSON pointer (`/lines/0/sku`), as merge
 * errors name them. A pointer reaches any key, `~0`/`~1`-escaped; the dotted form cannot name a key holding a dot or a
 * bracket, since it splits there.
 */
export const pathSegments = (path: string): string[] => {
  const isPointer = path.startsWith('/');

  if (!isPointer) return path.match(DOTTED_SEGMENT) ?? [];

  if (path === ROOT_POINTER) return [];

  return path.split('/').slice(1).map(unescapePointer);
};

const escapePointer = (segment: string): string => segment.replaceAll('~', '~0').replaceAll('/', '~1');

/** The JSON pointer for `segments`; keys holding a dot or a bracket stay intact, unlike in the dotted form. */
export const pointerOf = (segments: string[]): string => {
  const escaped = segments.map(escapePointer);

  return `/${escaped.join('/')}`;
};

export const valueAt = (root: unknown, segments: string[]): unknown => {
  const [head, ...rest] = segments;

  if (head === undefined) return root;

  if (Array.isArray(root)) return valueAt(root[Number(head)], rest);

  if (!isRecord(root)) return undefined;

  return valueAt(root[head], rest);
};

const itemsOf = (container: unknown): unknown[] => {
  if (!Array.isArray(container)) return [];

  const items: unknown[] = container;

  return [...items];
};

const recordOf = (container: unknown): Record<string, unknown> => {
  if (isRecord(container)) return container;

  const empty: Record<string, unknown> = {};

  return empty;
};

const setAt = (container: unknown, segments: string[], value: unknown): unknown => {
  const [head, ...rest] = segments;

  if (head === undefined) return value;

  const isIndex = INDEX.test(head);
  const isArray = Array.isArray(container);
  const isObject = isRecord(container);
  const startsArray = isIndex && !isObject;

  if (isArray || startsArray) {
    const items = itemsOf(container);
    const index = Number(head);

    items[index] = setAt(items[index], rest, value);

    return items;
  }

  const record = recordOf(container);
  const child = setAt(record[head], rest, value);
  const written: Record<string, unknown> = { ...record, [head]: child };

  return written;
};

const isContainer = (value: unknown): value is JsonContainer => isRecord(value) || Array.isArray(value);

/** A copy of `root` with `value` at `segments`, creating objects (or arrays, for index segments) along the way. */
export const withValueAt = (root: JsonContainer, segments: string[], value: unknown): JsonContainer => {
  const written = setAt(root, segments, value);

  return isContainer(written) ? written : root;
};
