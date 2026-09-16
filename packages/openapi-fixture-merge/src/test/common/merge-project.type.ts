export type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
};

export type MergeProject = {
  /** Temporary working directory holding every merge input and output. */
  readonly directory: string;
  readonly corruptFile: string;
  readonly populatedFile: string;
  /** Exact endpoint URL used to derive the merged artifact filename. */
  readonly endpointUrl: string;
  readonly outFile: string;
  readonly provenanceFile: string;
  /** `file://` URL of the shared invoice spec used for validation. */
  readonly specUrl: string;
  /** Writes a file into the directory and returns its absolute path. */
  readonly write: (name: string, source: string) => Promise<string>;
  /** Spawns `src/cli.ts` with the workspace source condition. */
  readonly run: (args: string[]) => Promise<CliResult>;
  readonly dispose: () => Promise<void>;
};
