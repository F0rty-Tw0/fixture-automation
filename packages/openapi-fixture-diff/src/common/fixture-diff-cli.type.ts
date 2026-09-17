export type CorruptOptions = {
  readonly fixtureFile: string;
  readonly outFile: string;
  readonly paths: string[];
};

export type DiffOptions = {
  readonly specUrl: string;
  /** The raw positional; absent means the spec's `x-root-schema`, or a prompt when it has none. */
  readonly schemaName: string | undefined;
  readonly fixtureFile: string;
  readonly outDir: string;
  readonly requiredOnly: boolean;
  readonly objectShape?: string | undefined;
};
