import type { SchemaDialect } from '@fixture-automation/openapi-ai-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import type { SchemaComponents, SpecSchema, SpecSchemas } from './schema.type.ts';

export type MissingEntry = {
  readonly path: string;
  readonly schema: SpecSchema;
};

/** A present property value the walk may flag for a refill instead of descending into it. */
export type ReplaceCandidate = {
  readonly path: string;
  readonly key: string;
  readonly schema: SpecSchema;
  readonly value: unknown;
};

export type ReplaceablePredicate = (candidate: ReplaceCandidate) => boolean;

/** The part of an AJV error the diff reads; `instancePath` is a JSON Pointer into the validated payload. */
export type SchemaViolation = {
  readonly keyword: string;
  readonly instancePath: string;
};

export type WalkInput = {
  readonly schema: SpecSchema;
  readonly value: unknown;
  readonly path: string;
  readonly schemas: SpecSchemas;
  readonly requiredOnly: boolean;
  readonly ancestry: string[];
  readonly isReplaceable: ReplaceablePredicate;
};

export type WalkFunction = (input: WalkInput) => MissingEntry[];

export type FixtureDiffRequest = {
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly fixture: unknown;
  readonly requiredOnly: boolean;
  readonly objectShape?: string | undefined;
  /** Also refill present values that violate the schema or equal an openapi-sampler type default; absent means off. */
  readonly replacePlaceholders?: boolean | undefined;
};

export type FixtureDiff = {
  readonly schemaName: string;
  readonly dialect: SchemaDialect;
  /** Every path to fill: the absent values and the `replaced` ones, in walk order. */
  readonly paths: string[];
  /** The subset of `paths` that held a placeholder or schema-invalid value; empty unless `replacePlaceholders`. */
  readonly replaced: string[];
  readonly schema: SpecSchema;
  readonly components: SchemaComponents;
  /** The fixture without the `replaced` paths: fill and merge onto this, not the original. Never written to `missing.json`. */
  readonly baseline: unknown;
};

export type MissingFiles = {
  readonly jsonFile: string;
  readonly typesFile: string;
  readonly stubFile: string;
};
