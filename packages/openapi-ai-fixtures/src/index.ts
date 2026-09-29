export { aiFixtures } from './fixture-enrichment/domain-logic/ai-fixtures.ts';

export { aiMissingFixture } from './fixture-enrichment/domain-logic/ai-missing-fixtures.ts';

export { createAiProgressReporter } from './ai-fixtures-cli/data-access/ai-progress.client.ts';

export { parseMissingFile } from './missing-values/utils/missing-file.util.ts';

export { missingDocument } from './missing-values/utils/missing-document.util.ts';

export { missingPrompt, missingPromptBytes } from './fixture-enrichment/utils/fixture-prompt.util.ts';

export { missingCheck } from './missing-values/utils/missing-check.util.ts';

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
  MissingPromptInput,
  MissingValidator,
  MissingVerdict
} from './missing-values/common/missing.type.ts';

export type { ModelDiscovery, ModelDiscoveryOptions, ModelSelection } from './model-discovery/common/model.type.ts';

export type { PreparedSchema, SchemaDialect } from './schema/common/schema.type.ts';
