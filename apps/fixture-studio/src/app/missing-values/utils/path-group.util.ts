import type { PathGroup } from '../common/missing-values.type.ts';

/** A leading property name, or a leading `[index]` when the payload is an array. */
const ROOT_SEGMENT = /^(?:\[[^\]]*\]|[^.[]+)/u;

/** The path's first segment below the envelope: `customer` for `data.customer.address.city` inside `data`. */
const rootOf = (path: string, envelope: string | undefined): string => {
  const prefix = `${envelope}.`;
  const isEnveloped = envelope !== undefined && path.startsWith(prefix);
  const unprefixed = path.slice(prefix.length);
  const inner = isEnveloped ? unprefixed : path;
  const match = ROOT_SEGMENT.exec(inner);

  return match?.[0] ?? inner;
};

/** Groups paths by their first segment below the envelope, groups and paths in first-seen order. */
export const groupPathsByRoot = (paths: string[], envelope: string | undefined): PathGroup[] => {
  const groups = new Map<string, string[]>();

  for (const path of paths) {
    const root = rootOf(path, envelope);
    const members = groups.get(root) ?? [];

    members.push(path);
    groups.set(root, members);
  }

  const toGroup = ([root, members]: [string, string[]]): PathGroup => {
    const group: PathGroup = { root, paths: members };

    return group;
  };

  const entries = [...groups];

  return entries.map(toGroup);
};
