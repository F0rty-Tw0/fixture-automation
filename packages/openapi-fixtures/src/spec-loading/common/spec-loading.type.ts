/** Limits on an http(s) spec download; defaults are 30 s and 20 MB. */
export type SpecLoadOptions = {
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
};
