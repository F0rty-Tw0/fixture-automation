export { diffFixture } from './fixture-diff/domain-logic/fixture-diff.ts';

export { writeBaselineFile, writeMissingFiles } from './fixture-diff/domain-logic/missing-files.ts';

export { missingProjection } from './fixture-diff/utils/missing-projection.util.ts';

export { compiledSchema, schemaViolations } from './fixture-diff/utils/payload-check.util.ts';

export { isItemList } from './schema/utils/schema-list.util.ts';

export { isSchema } from './schema/utils/schema-record.util.ts';

export { resolveSchema } from './schema/utils/schema-resolve.util.ts';

export { dropPaths, hasPath } from './shared/fixture-path/utils/drop-path.util.ts';

export { parsePath } from '@fixture-automation/shared';

export type {
  BrokenEntry,
  FixtureDiff,
  FixtureDiffRequest,
  MissingEntry,
  MissingFiles,
  ReplaceablePredicate,
  ReplaceCandidate,
  WalkInput
} from './fixture-diff/common/missing.type.ts';

export type { SchemaComponents, SpecSchema, SpecSchemas } from './schema/common/schema.type.ts';

export type { PathToken } from '@fixture-automation/shared';
