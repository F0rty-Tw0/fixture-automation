import { parsePath } from '@fixture-automation/openapi-fixture-diff';
import type { PathToken } from '@fixture-automation/openapi-fixture-diff';
import { isRecord } from '@fixture-automation/shared';

const tailsOf = (routes: PathToken[][]): PathToken[][] => routes.map((route: PathToken[]): PathToken[] => route.slice(1));

/** Closes the object nodes the routes pass through; a node no route passes through is a leaf and stays as it is. */
function closedNode(node: unknown, routes: PathToken[][]): unknown {
  const passing = routes.filter((route: PathToken[]): boolean => route.length > 0);
  const isLeaf = passing.length === 0 || !isRecord(node);

  if (isLeaf) return node;

  const isArrayStep = typeof passing[0]?.[0] === 'number';

  if (isArrayStep) {
    const items = closedNode(node['items'], tailsOf(passing));
    const array = { ...node, items };

    return array;
  }

  const properties = node['properties'];

  if (!isRecord(properties)) return node;

  const closeEntry = ([key, value]: [string, unknown]): [string, unknown] => {
    const keyRoutes = passing.filter((route: PathToken[]): boolean => route[0] === key);

    return [key, closedNode(value, tailsOf(keyRoutes))];
  };
  const closedProperties = Object.fromEntries(Object.entries(properties).map(closeEntry));
  const object = { ...node, additionalProperties: false, properties: closedProperties };

  return object;
}

/**
 * The missing projection with `additionalProperties: false` on every object node the missing paths pass through, so a
 * schema-constrained model answers only the missing keys instead of inventing siblings. Leaf schemas are untouched.
 */
export const closedProjection = (schema: unknown, paths: string[]): unknown => closedNode(schema, paths.map(parsePath));
