export type FillResult = {
  /** Merged value; the inputs are never mutated. */
  readonly value: unknown;
  /** Dotted paths that the fill supplied or replaced, array elements as `name[index]`. */
  readonly filled: string[];
};

export type FillOptions = {
  /** Keep every present fixture value, even one whose JSON type or casing differs from the fill; only absent keys are filled. */
  readonly keepPresent: boolean;
};
