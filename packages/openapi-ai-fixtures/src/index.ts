export { aiFixtures } from './fixture-enrichment/domain-logic/ai-fixtures.ts';

export { aiMissingFixture } from './fixture-enrichment/domain-logic/ai-missing-fixtures.ts';

export { AiFillRejectedError } from './fixture-enrichment/common/ai-fill-rejected.error.ts';

export { createAiProgressReporter } from './ai-fixtures-cli/data-access/ai-progress.client.ts';

export { parseMissingFile } from './missing-values/utils/missing-file.util.ts';

export { missingDocument } from './missing-values/utils/missing-document.util.ts';

export { missingPrompt, missingPromptBytes, patternPromptBytes } from './fixture-enrichment/utils/fixture-prompt.util.ts';

export { missingPatterns, pathPattern } from './missing-patterns/utils/path-pattern.util.ts';

export { baselineContext } from './missing-patterns/utils/baseline-context.util.ts';

export { missingCheck } from './missing-values/utils/missing-check.util.ts';

export { isListFill } from './missing-values/utils/missing-fill.util.ts';

export { pathTree, valueAtPath, valueAtTokens } from './missing-values/utils/path-tree.util.ts';

export { discoverModels } from './model-discovery/domain-logic/model-discovery.ts';

export { detectAiTools } from './tool-install/data-access/ai-tool-install.client.ts';

export { selectModel } from './model-discovery/domain-logic/model-select.ts';

export { MISSING_SCENARIO } from './ai-fixtures-cli/common/ai-fixtures-cli.const.ts';

export { MISSING_PROMPT_LIMIT_BYTES } from './missing-values/common/missing.const.ts';

export { prepareSchema } from './schema/utils/schema-context.util.ts';

export { schemaDialect } from './schema/utils/schema-dialect.util.ts';

export { normalizeSchema } from './schema/utils/schema-normalization.util.ts';

export { compileFixtureSchema } from './schema/utils/schema-validator.util.ts';

export type {
  AiFixtureFactory,
  AiFixtureOptions,
  AiFixtureProgress,
  AiFixtureRequest,
  AiTool,
  AiToolInstall
} from './shared/ai-tool/common/ai-fixtures.type.ts';

export type {
  AiMissingFactory,
  AiMissingRequest,
  MissingFile,
  MissingFill,
  MissingPromptInput,
  MissingValidator,
  MissingVerdict,
  MissingViolation,
  PathValue
} from './missing-values/common/missing.type.ts';

export type { MissingPattern, PatternPromptInput } from './missing-patterns/common/missing-pattern.type.ts';

export type { ModelDiscovery, ModelDiscoveryOptions, ModelSelection } from './model-discovery/common/model.type.ts';

export type { PreparedSchema, SchemaDialect } from './schema/common/schema.type.ts';
