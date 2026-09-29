import type { SchemaDialect } from '../../schema/common/schema.type.ts';

type MissingSchemas = Record<string, unknown>;

type MissingComponents = {
  readonly schemas: MissingSchemas;
};

/** The `missing.json` contract emitted by `openapi-fixture-diff diff`; self-contained by design. */
export type MissingFile = {
  /** Schema key the corrupt fixture was diffed against. */
  readonly schemaName: string;
  readonly dialect: SchemaDialect;
  /** Dotted paths of the absent values, with `[i]` for array indices. */
  readonly paths: string[];
  /** Nested JSON Schema holding only the absent properties. */
  readonly schema: unknown;
  /** Normalized schema components the projection may reference. */
  readonly components: MissingComponents;
};

/** Whether a generated fill satisfies the missing projection; `details` is the `path: message; ...` line when it does not. */
export type MissingVerdict = {
  readonly valid: boolean;
  readonly details: string;
};

/** Judges a generated fill against its missing projection, e.g. off the caller's event loop. */
export type MissingValidator = (missing: MissingFile, value: unknown) => Promise<MissingVerdict>;

export type AiMissingRequest = {
  /** The corrupt fixture, used as the coherence baseline; it is never mutated. */
  readonly fixture: unknown;
  readonly missing: MissingFile;
  /** Natural-language scenario; the missing schema remains authoritative. */
  readonly scenario: string;
  /** Replaces the in-process AJV check, which blocks the calling thread for as long as a schema `pattern` backtracks. */
  readonly validate?: MissingValidator;
};

export type AiMissingFactory = (name: string, request: AiMissingRequest) => Promise<Record<string, unknown>>;

export type MissingPromptInput = {
  /** Serialized baseline fixture. */
  readonly fixtureJson: string;
  /** Self-contained schema document for the absent properties; the full spec never enters the prompt. */
  readonly missing: unknown;
  readonly scenario: string;
};
