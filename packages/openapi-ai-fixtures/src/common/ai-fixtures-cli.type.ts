import type { AiFixtureOptions } from './ai-fixtures.type.ts';

export type AiFixtureCliOptions = {
  /** Absent in missing-field mode, which never reads the spec. */
  readonly specUrl: string | undefined;
  /** The raw positional; absent means the spec's `x-root-schema` (or a prompt when it has none), or `missing.json`. */
  readonly schemaName: string | undefined;
  readonly fixtureFile: string;
  readonly scenario: string;
  readonly options: AiFixtureOptions;
  readonly outFile: string | undefined;
  readonly typesFile: string | undefined;
  /** `missing.json` from `openapi-fixture-diff`; present only in missing-field mode. */
  readonly missingFile?: string;
};

/** The positionals as parsed, before the spec resolves which of `[schema-name] [out-file]` was meant. */
export type CliPositionals = Pick<AiFixtureCliOptions, 'specUrl' | 'schemaName' | 'outFile'>;

export type FixtureOutput = {
  readonly file: string | undefined;
  readonly typesImport: string | undefined;
};
