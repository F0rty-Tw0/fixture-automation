/** Missing paths that differ only in their array indices, e.g. `lines[*].qty` for `lines[0].qty` and `lines[1].qty`. */
export type MissingPattern = {
  /** The shared path with every index written as `[*]`. */
  readonly pattern: string;
  /** The concrete paths in `missing.paths` order; the i-th one gets the answer's `i % examples` example. */
  readonly paths: string[];
};

export type PatternPromptInput = {
  /** The baseline fixture; only its digest reaches the prompt. */
  readonly fixture: unknown;
  /** Self-contained schema document for the absent properties. */
  readonly missing: unknown;
  readonly patterns: MissingPattern[];
  readonly scenario: string;
  /** Name of the whole baseline staged in the agent's working directory; absent keeps the agent tool-free. */
  readonly baselineFile?: string;
};
