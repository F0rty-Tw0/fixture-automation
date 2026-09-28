import { randomUUID } from 'node:crypto';

import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { statusError } from '../utils/status-error.util.ts';

// ponytail: in-memory, last 5 specs only, lost on restart; persist to disk when specs must outlive the process.
const SPEC_CACHE_LIMIT = 5;
const RELOAD_FIX = 'load the spec again; the API keeps only the last few in memory';

/** Loaded specs by a random `specId`; past `SPEC_CACHE_LIMIT` the least recently used one is evicted. */
export class SpecCache {
  private readonly specs = new Map<string, OpenApiSpec>();

  public add(spec: OpenApiSpec): string {
    const specId = randomUUID();

    this.specs.set(specId, spec);

    const isOverLimit = this.specs.size > SPEC_CACHE_LIMIT;
    const oldestId = this.specs.keys().next().value;

    if (isOverLimit && oldestId !== undefined) this.specs.delete(oldestId);

    return specId;
  }

  /** The cached spec, now the most recently used, or a 404 `FixtureError` telling the caller to load it again. */
  public require(specId: string): OpenApiSpec {
    const spec = this.specs.get(specId);

    if (spec === undefined) throw statusError(404, 'spec not found', RELOAD_FIX);

    this.specs.delete(specId);
    this.specs.set(specId, spec);

    return spec;
  }
}
