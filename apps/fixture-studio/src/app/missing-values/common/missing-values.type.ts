/** Fixture paths that share their first segment, e.g. every missing path under `customer`. */
export type PathGroup = {
  readonly root: string;
  readonly paths: string[];
};
