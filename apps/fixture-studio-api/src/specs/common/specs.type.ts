import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

/** Loaded specs by id, shared by every route of one server. */
export type SpecStore = {
  add(spec: OpenApiSpec): string;
  /** The cached spec, or a 404 `FixtureError`. */
  require(specId: string): OpenApiSpec;
};

/** The `:specId` path parameter of every route that works on a loaded spec. */
export type SpecParams = {
  readonly specId: string;
};
