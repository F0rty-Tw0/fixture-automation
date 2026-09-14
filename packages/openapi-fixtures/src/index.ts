export { loadSpec, parseSpecUrl } from './data-access/openapi-spec.client.ts';

export { fixtures } from './data-access/fixtures.client.ts';

export { runCli } from './data-access/cli-runner.client.ts';

export { cliInputs, promptedInputs, terminalQuestion } from './data-access/input-prompt.client.ts';

export { silentInputs } from './utils/silent-inputs.util.ts';

export { readJsonFile, readTextFile, writeTextFile } from './data-access/json-file.client.ts';

export { schemaSuggestion } from './utils/schema-suggestion.util.ts';

export { pruneSpec } from './utils/prune-spec.util.ts';

export { reachableSchemas } from './utils/reachable-schemas.util.ts';

export { referenceName } from './utils/schema-reference.util.ts';

export { resolveSchemaName, schemaTarget } from './utils/schema-name.util.ts';

export { typescriptImport } from './utils/typescript-import.util.ts';

export { typescriptStub } from './utils/typescript-stub.util.ts';

export { FixtureError } from './common/fixture.error.ts';

export type { InputSpec, Inputs, Question } from './common/input.type.ts';

export type { OpenApiSpec, SampleOptions, SchemaMap, SchemaTarget } from './common/openapi.type.ts';
