export type PopulatedModuleProject = {
  /** Temporary directory carrying an ESM package manifest. */
  readonly directory: string;
  /** Path to the generated `populated.stub.ts` typed stub. */
  readonly stubFile: string;
  /** Writes an extra module into the directory and returns its absolute path. */
  readonly write: (name: string, source: string) => Promise<string>;
  readonly dispose: () => Promise<void>;
};
