export type FillResult = {
  /** Merged value; the inputs are never mutated. */
  readonly value: unknown;
  /** Dotted paths that the fill supplied or replaced, array elements as `name[index]`. */
  readonly filled: string[];
};
