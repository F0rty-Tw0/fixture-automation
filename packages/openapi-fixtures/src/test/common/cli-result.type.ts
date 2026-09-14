export type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
  /** Exit code of the spawned CLI; `0` when it succeeded. */
  readonly code: number;
};
