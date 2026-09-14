export type ProcessWorkspace = {
  readonly directory: string;
  readonly dispose: () => Promise<void>;
  readonly file: (name: string) => string;
  readonly waitForFile: (name: string) => Promise<string>;
};
