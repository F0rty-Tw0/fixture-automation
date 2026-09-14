import { parsePath } from './drop-path.util.ts';
import type { MissingEntry } from '../common/missing.type.ts';
import type { PathToken } from '../common/path.type.ts';
import type { ProjectionNode } from '../common/projection.type.ts';
import type { SpecSchema } from '../common/schema.type.ts';

const newNode = (): ProjectionNode => {
  const node: ProjectionNode = { leaf: undefined, items: undefined, properties: new Map() };

  return node;
};

const childNode = (node: ProjectionNode, token: PathToken): ProjectionNode => {
  if (typeof token === 'number') {
    node.items ??= newNode();

    return node.items;
  }

  const existing = node.properties.get(token);

  if (existing !== undefined) return existing;

  const created = newNode();

  node.properties.set(token, created);

  return created;
};

function nodeSchema(node: ProjectionNode): SpecSchema {
  if (node.leaf !== undefined) return node.leaf;

  if (node.items !== undefined) {
    const items = nodeSchema(node.items);
    const array: SpecSchema = { type: 'array', items };

    return array;
  }

  const properties: Record<string, SpecSchema> = {};
  const required: string[] = [];

  for (const [key, child] of node.properties) {
    properties[key] = nodeSchema(child);
    required.push(key);
  }

  const object: SpecSchema = { type: 'object', required, properties };

  return object;
}

/** Nested schema of the missing properties; array indices collapse into one `items` union of keys. */
export const missingProjection = (entries: MissingEntry[]): SpecSchema => {
  const root = newNode();

  for (const entry of entries) {
    let node = root;

    for (const token of parsePath(entry.path)) node = childNode(node, token);

    node.leaf = entry.schema;
  }

  return nodeSchema(root);
};
