export type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
};

export type DiffProject = {
  readonly directory: string;
  readonly specUrl: string;
  readonly fixtureFile: string;
  readonly corruptFile: string;
  readonly run: (args: string[]) => Promise<CliResult>;
  readonly dispose: () => Promise<void>;
};
