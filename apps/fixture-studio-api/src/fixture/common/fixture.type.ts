import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

/** What the sampler completion reads: `baseline` is completed, `fixture` gives the key order. */
export type CompletionInput = {
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly fixture: unknown;
  readonly baseline: unknown;
  /** An envelope property the fixture holds, or `undefined` for the whole fixture. */
  readonly objectShape: string | undefined;
  readonly requiredOnly: boolean;
  /** Keep every present value, even a broken one, instead of letting the sampler replace it. */
  readonly keepPresent: boolean;
};

export type Completion = {
  readonly json: string;
  /** Plain-language notes on a completion that fell back to the baseline. */
  readonly warnings: string[];
};

/** Where a diff or merge reads the payload from, and what it tells the user about that choice. */
export type ShapeChoice = {
  /** The envelope property holding the payload, or `undefined` for the whole fixture. */
  readonly objectShape: string | undefined;
  /** The requested envelope when the fixture lacks it and nothing else looks like the payload: fill and merge nothing. */
  readonly unplaced: string | undefined;
  readonly warnings: string[];
};
