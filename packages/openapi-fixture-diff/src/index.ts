export { diffFixture } from './data-access/fixture-diff.client.ts';

export { writeBaselineFile, writeMissingFiles } from './data-access/missing-files.client.ts';

export { dropPaths, hasPath, parsePath } from './utils/drop-path.util.ts';

export { missingProjection } from './utils/missing-projection.util.ts';

export { isSchema } from './utils/schema-record.util.ts';

export type {
  FixtureDiff,
  FixtureDiffRequest,
  MissingEntry,
  MissingFiles,
  ReplaceablePredicate,
  ReplaceCandidate,
  WalkInput
} from './common/missing.type.ts';

export type { PathToken } from './common/path.type.ts';

export type { SchemaComponents, SpecSchema, SpecSchemas } from './common/schema.type.ts';
