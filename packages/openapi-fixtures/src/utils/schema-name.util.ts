import { FixtureError } from '../common/fixture.error.ts';
import type { InputSpec, Inputs } from '../common/input.type.ts';
import type { OpenApiSpec, SchemaTarget } from '../common/openapi.type.ts';

const NAME_FIX = 'pass <schema-name>, or use a spec written by openapi-types <spec-url> <schema-name> <out-file>';

/** The given schema name, else the `x-root-schema` a pruned spec carries. */
export const resolveSchemaName = (spec: OpenApiSpec, given: string | undefined): string => {
  if (given) return given;

  const root = spec['x-root-schema'];

  if (typeof root === 'string' && root !== '') return root;

  throw new FixtureError('schema name required', NAME_FIX);
};

/** A terminal run is asked for the schema name only when the spec carries no root to default to. */
export const askSchemaName = async (
  spec: OpenApiSpec,
  given: string | undefined,
  input: InputSpec,
  inputs: Inputs
): Promise<string | undefined> => {
  const root = spec['x-root-schema'];
  const hasRoot = typeof root === 'string' && root !== '';

  if (hasRoot) return given;

  return inputs.optional(given, input);
};

/**
 * Split the `[schema-name] [out-file]` positionals that follow a spec URL.
 *
 * A lone value is the schema name when the spec declares it, else the out-file when the spec
 * carries `x-root-schema`; without a root it can only be a misspelled schema name, so that is
 * reported with a suggestion. Two values are always explicit.
 */
export const schemaTarget = (spec: OpenApiSpec, first: string | undefined, second: string | undefined): SchemaTarget => {
  if (second !== undefined) {
    const explicit: SchemaTarget = { schemaName: resolveSchemaName(spec, first), outFile: second };

    return explicit;
  }

  const schemas = spec.components?.schemas ?? {};
  const isDeclared = Object.hasOwn(schemas, first ?? '');
  const hasRoot = spec['x-root-schema'] !== undefined;
  const isTypo = first !== undefined && !hasRoot;

  if (isDeclared || isTypo) {
    const named: SchemaTarget = { schemaName: first ?? '', outFile: undefined };

    return named;
  }

  const defaulted: SchemaTarget = { schemaName: resolveSchemaName(spec, undefined), outFile: first };

  return defaulted;
};
