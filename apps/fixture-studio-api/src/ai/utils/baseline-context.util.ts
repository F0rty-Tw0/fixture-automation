import { isRecord, parsePath } from '@fixture-automation/shared';
import type { PathToken } from '@fixture-automation/shared';

/** The parent chains of the kept paths, merged: each node's children are the tokens some path steps through. */
type ChainNode = Map<PathToken, ChainNode>;

const chainTree = (paths: string[]): ChainNode => {
  const root: ChainNode = new Map();

  for (const path of paths) {
    const parents = parsePath(path).slice(0, -1);
    let node = root;

    for (const token of parents) {
      const child: ChainNode = node.get(token) ?? new Map<PathToken, ChainNode>();

      node.set(token, child);
      node = child;
    }
  }

  return root;
};

const isContainer = (value: unknown): boolean => Array.isArray(value) || isRecord(value);

const primitiveFields = (value: Record<string, unknown>): Record<string, unknown> => {
  const entries = Object.entries(value).filter(([, field]: [string, unknown]): boolean => !isContainer(field));

  return Object.fromEntries(entries);
};

/** An array element no path enters: an object keeps its primitives, an array empties, a primitive stays. */
const offChainElement = (value: unknown): unknown => {
  if (Array.isArray(value)) return [];

  if (isRecord(value)) return primitiveFields(value);

  return value;
};

/** `node` is where the kept paths go next; `undefined` means none enters this value. */
function prunedValue(value: unknown, node: ChainNode | undefined): unknown {
  if (node === undefined) return offChainElement(value);

  if (Array.isArray(value)) return value.map((element: unknown, index: number): unknown => prunedValue(element, node.get(index)));

  if (!isRecord(value)) return value;

  const pruned: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(value)) {
    const child = node.get(key);
    const isNested = isContainer(field);

    if (child !== undefined) pruned[key] = prunedValue(field, child);
    else if (!isNested) pruned[key] = field;
  }

  return pruned;
}

/**
 * The part of `fixture` a model needs to fill `paths` coherently: the primitives of every object on each path's
 * parent chain (the root included), with every array on a chain kept at full length so an index-by-index merge
 * stays visible. Subtrees off every chain are dropped; the input is never mutated and key order follows it.
 */
export const baselineContext = (fixture: unknown, paths: string[]): unknown => {
  const tree = chainTree(paths);

  return prunedValue(fixture, tree);
};
