export type CompiledStub = {
  readonly value: unknown;
  readonly dispose: () => Promise<void>;
};
