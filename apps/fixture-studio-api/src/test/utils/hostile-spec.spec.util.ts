import type { MissingFile } from '../../contract/common/studio-api.type.ts';

const INFO_VERSION = '1';

/** Paths holding one operation whose 200 JSON response is `#/components/schemas/<schemaName>`. */
const namedPaths = (path: string, schemaName: string): Record<string, unknown> => {
  const schema = { $ref: `#/components/schemas/${schemaName}` };
  const json = { schema };
  const content = { 'application/json': json };
  const success = { content };
  const responses = { '200': success };
  const get = { responses };
  const route = { get };
  const paths = { [path]: route };

  return paths;
};

const fanOutLevel = (level: number, depth: number, width: number): Record<string, unknown> => {
  const leaf = { type: 'string' };

  if (level === depth) return leaf;

  const reference = { $ref: `#/components/schemas/level${level + 1}` };
  const names = Array.from({ length: width }, (_value: unknown, index: number): string => `p${index}`);
  const entries = names.map((name: string): [string, unknown] => [name, reference]);
  const properties = Object.fromEntries(entries);
  const node = { type: 'object', required: names, properties };

  return node;
};

/**
 * A few KB of spec whose `level0` schema is a DAG: every level references the next `width` times,
 * so sampling it inlines `width ** depth` leaves. `GET /fan` answers `level0`.
 */
export const fanOutDocument = (depth: number, width: number): Record<string, unknown> => {
  const levelNumbers = Array.from({ length: depth + 1 }, (_value: unknown, level: number): number => level);
  const levels = levelNumbers.map((level: number): [string, unknown] => [`level${level}`, fanOutLevel(level, depth, width)]);
  const schemas = Object.fromEntries(levels);
  const components = { schemas };
  const paths = namedPaths('/fan', 'level0');
  const info = { title: 'fan-out', version: INFO_VERSION };
  const document = { openapi: '3.0.0', info, paths, components };

  return document;
};

const backtrackingNamed = (): Record<string, unknown> => {
  const name = { type: 'string', pattern: '^(a+)+$' };
  const properties = { name };
  const named = { type: 'object', properties };

  return named;
};

/** A `missing` for `backtrackingDocument`'s `named`, so its `name` carries the backtracking `pattern`. */
export const backtrackingMissing = (): MissingFile => {
  const schema = backtrackingNamed();
  const components = { schemas: {} };
  const missing: MissingFile = { schemaName: 'named', dialect: 'openapi-30', paths: ['name'], schema, components };

  return missing;
};

/** `GET /named` answers a `named` object whose `name` must match the catastrophically backtracking `^(a+)+$`. */
export const backtrackingDocument = (): Record<string, unknown> => {
  const named = backtrackingNamed();
  const schemas = { named };
  const components = { schemas };
  const paths = namedPaths('/named', 'named');
  const info = { title: 'backtracking', version: INFO_VERSION };
  const document = { openapi: '3.0.0', info, paths, components };

  return document;
};
