export type CorruptOptions = {
  readonly fixtureFile: string;
  readonly outFile: string;
  readonly paths: string[];
};

export type DiffOptions = {
  readonly specUrl: string;
  /** Absent means the name comes from the spec's `x-root-schema`. */
  readonly schemaName: string | undefined;
  readonly fixtureFile: string;
  readonly outDir: string;
  readonly requiredOnly: boolean;
  readonly objectShape?: string | undefined;
};
