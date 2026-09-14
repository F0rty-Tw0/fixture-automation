export type FillResult = {
  /** Merged value; the inputs are never mutated. */
  readonly value: unknown;
  /** Dotted paths that the fill supplied, array elements as `name[index]`. */
  readonly filled: string[];
};

export type MergeSpec = {
  /** Spec URL for `loadSpec`: `http(s)://` or `file://`. */
  readonly url: string;
  /** Component schema name the merged fixture is validated against; absent means the spec's `x-root-schema`. */
  readonly schemaName: string | undefined;
};

export type MergeInput = {
  /** JSON fixture with fields removed. */
  readonly corruptFile: string;
  /** `.json` fixture or `.ts`/`.mts`/`.js`/`.mjs` module exporting exactly one value. */
  readonly populatedFile: string;
  /** Destination for the merged fixture. */
  readonly outFile: string;
  /** Absent means the merged fixture is written without schema validation. */
  readonly spec?: MergeSpec;
};

export type MergeResult = {
  readonly value: unknown;
  readonly filled: string[];
  readonly outFile: string;
};
