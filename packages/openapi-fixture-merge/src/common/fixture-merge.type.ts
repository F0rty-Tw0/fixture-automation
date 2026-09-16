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
  /** Directory receiving the endpoint-named JSON and its provenance sidecar. */
  readonly outDir: string;
  /** Endpoint identity (URL or METHOD, path), optionally prefixed by subdirectory before hashing. */
  readonly endpointUrl: string;
  /** Optional literal top-level property containing the merge and validation payload. */
  readonly objectShape?: string | undefined;
  /** Optional path segment prefixed to the endpoint identity before hashing. */
  readonly subdirectory?: string | undefined;
  /** Absent means the merged fixture is written without schema validation. */
  readonly spec?: MergeSpec;
};

export type MergeProvenance = {
  readonly endpointUrl: string;
  /** Lowercase hexadecimal SHA-256 of the merged file's exact UTF-8 bytes, including its final newline. */
  readonly sha256: string;
};

export type MergeResult = {
  readonly value: unknown;
  readonly filled: string[];
  readonly outFile: string;
  readonly provenanceFile: string;
  readonly provenance: MergeProvenance;
};
