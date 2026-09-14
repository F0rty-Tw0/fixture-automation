export type ServedSpec = {
  readonly url: URL;
  readonly dispose: () => Promise<void>;
};
