export { aiFixtures } from './data-access/ai-fixtures.client.ts';

export { aiMissingFixture } from './data-access/ai-missing-fixtures.client.ts';

export { parseMissingFile } from './utils/missing-file.util.ts';

export { prepareSchema } from './utils/schema-context.util.ts';

export { schemaDialect } from './utils/schema-dialect.util.ts';

export { compileFixtureSchema } from './utils/schema-validator.util.ts';

export type { AiFixtureFactory, AiFixtureOptions, AiFixtureRequest, AiTool } from './common/ai-fixtures.type.ts';

export type { AiMissingFactory, AiMissingRequest, MissingFile, MissingPromptInput } from './common/missing.type.ts';

export type { PreparedSchema, SchemaDialect } from './common/schema.type.ts';
