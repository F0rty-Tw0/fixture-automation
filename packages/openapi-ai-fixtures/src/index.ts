export { aiFixtures } from './data-access/ai-fixtures.client.ts';

export { aiMissingFixture } from './data-access/ai-missing-fixtures.client.ts';

export { createAiProgressReporter } from './data-access/ai-progress.client.ts';

export { parseMissingFile } from './utils/missing-file.util.ts';

export { missingDocument } from './utils/missing-document.util.ts';

export { missingPrompt } from './utils/fixture-prompt.util.ts';

export { missingCheck } from './utils/missing-check.util.ts';

export { discoverModels } from './data-access/model-discovery.client.ts';

export { detectAiTools } from './data-access/ai-tool-install.client.ts';

export { selectModel } from './data-access/model-select.client.ts';

export { MISSING_SCENARIO } from './common/ai-fixtures-cli.const.ts';

export { prepareSchema } from './utils/schema-context.util.ts';

export { schemaDialect } from './utils/schema-dialect.util.ts';

export { normalizeSchema } from './utils/schema-normalization.util.ts';

export { compileFixtureSchema } from './utils/schema-validator.util.ts';

export type { AiFixtureFactory, AiFixtureOptions, AiFixtureProgress, AiFixtureRequest, AiTool, AiToolInstall } from './common/ai-fixtures.type.ts';

export type { AiMissingFactory, AiMissingRequest, MissingFile, MissingPromptInput, MissingValidator, MissingVerdict } from './common/missing.type.ts';

export type { ModelDiscovery, ModelDiscoveryOptions, ModelSelection } from './common/model.type.ts';

export type { PreparedSchema, SchemaDialect } from './common/schema.type.ts';
