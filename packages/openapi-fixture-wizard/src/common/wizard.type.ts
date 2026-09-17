import type { AiFixtureOptions, AiMissingFactory, AiTool, ModelDiscovery } from '@fixture-automation/openapi-ai-fixtures';
import type { FixtureDiff } from '@fixture-automation/openapi-fixture-diff';
import type { Inputs, OpenApiSpec, Question } from '@fixture-automation/openapi-fixtures';

export type WizardFormat = 'json' | 'ts' | 'both';

/** Only what touches a harness or the terminal is injected; file IO, sampling, diff and merge run for real. */
export type WizardDeps = {
  /** Reads one answer; the same function must back the `Inputs` given to `runWizard`. */
  readonly question: Question;
  readonly discover: (tool: AiTool) => Promise<ModelDiscovery>;
  readonly fill: (options: AiFixtureOptions) => AiMissingFactory;
};

export type GenerateRequest = {
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly outDir: string;
  readonly format: WizardFormat;
};

export type DiffRequest = {
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly fixtureFile: string;
  /** Directory receiving `missing.json`, `missing.d.ts` and `missing.stub.ts`. */
  readonly outDir: string;
  readonly requiredOnly: boolean;
  readonly objectShape?: string | undefined;
};

export type DiffResult = {
  /** The existing fixture as parsed from `fixtureFile`. */
  readonly fixture: unknown;
  readonly diff: FixtureDiff;
  readonly jsonFile: string;
  readonly typesFile: string;
  readonly stubFile: string;
};

/** Everything the steps after generation share; `fixtureFile` is the existing fixture being checked. */
export type WizardContext = {
  readonly inputs: Inputs;
  readonly deps: WizardDeps;
  readonly specUrl: string;
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  /** `METHOD,path` of the route that named the schema; `undefined` makes the merge ask for its endpoint. */
  readonly endpointUrl: string | undefined;
  readonly outDir: string;
  readonly fixtureFile: string;
  readonly objectShape: string | undefined;
};
