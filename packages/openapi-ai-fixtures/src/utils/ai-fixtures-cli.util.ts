import { parseArgs } from 'node:util';

import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { parseAiTool } from './ai-tool.util.ts';
import { AI_FIXTURES_USAGE, MISSING_SCENARIO } from '../common/ai-fixtures-cli.const.ts';
import type { AiFixtureCliOptions, CliPositionals } from '../common/ai-fixtures-cli.type.ts';
import type { AiFixtureOptions, AiTool } from '../common/ai-fixtures.type.ts';

const stringOption = { type: 'string' } as const;
const booleanOption = { type: 'boolean' } as const;
const helpOption = { type: 'boolean', short: 'h' } as const;
const cliOptions = {
  fixture: stringOption,
  missing: stringOption,
  scenario: stringOption,
  tool: stringOption,
  ts: stringOption,
  executable: stringOption,
  timeout: stringOption,
  model: stringOption,
  'list-models': booleanOption,
  help: helpOption
};

export const requiredValue = (value: string | undefined, message: string, fix?: string): string => {
  if (!value) throw new FixtureError(message, fix);

  return value;
};

const toolOptions = (
  name: string | undefined,
  executable: string | undefined,
  timeout: string | undefined,
  model: string | undefined
): AiFixtureOptions => {
  const tool = parseAiTool(name);
  let options: AiFixtureOptions = { tool };

  if (model !== undefined) {
    if (!model) throw new FixtureError('--model requires a model slug, or "default" for the harness default');

    options = { ...options, model };
  }

  if (executable !== undefined) {
    if (!executable) throw new FixtureError('--executable requires an absolute path');

    options = { ...options, executable };
  }

  if (timeout !== undefined) {
    const timeoutMs = Number(timeout);
    const isInteger = Number.isSafeInteger(timeoutMs);
    const isSupported = isInteger && timeoutMs > 0 && timeoutMs <= 2_147_483_647;

    if (!isSupported) throw new FixtureError('--timeout requires an integer from 1 to 2147483647 milliseconds');

    options = { ...options, timeoutMs };
  }

  return options;
};

/** Missing-field mode makes `--scenario` optional; every other mode still requires it. */
const fixtureScenario = (scenario: string | undefined, missingFile: string | undefined): string => {
  const isDefaulted = scenario === undefined && missingFile !== undefined;

  if (isDefaulted) return MISSING_SCENARIO;

  return requiredValue(scenario?.trim(), '--scenario requires non-empty text', '--scenario "an open invoice for 4200 cents"');
};

/**
 * `--missing` takes `[out-file]` alone, since the projection already names the schema; the old
 * `<spec-url> <schema-name> [out-file]` form still parses, with the spec ignored.
 */
const missingPositionals = (positionals: string[]): CliPositionals => {
  const isLegacy = positionals.length > 1;
  const outFile = isLegacy ? positionals[2] : positionals[0];
  const parsed: CliPositionals = { specUrl: undefined, schemaName: undefined, outFile };

  return parsed;
};

const scenarioPositionals = (positionals: string[]): CliPositionals => {
  const [rawSpecUrl, schemaName, outFile] = positionals;
  const specUrl = requiredValue(rawSpecUrl, AI_FIXTURES_USAGE);
  const parsed: CliPositionals = { specUrl, schemaName, outFile };

  return parsed;
};

const positionalsFor = (positionals: string[], isMissingMode: boolean): CliPositionals => {
  if (isMissingMode) return missingPositionals(positionals);

  return scenarioPositionals(positionals);
};

/** The harness whose models should be listed, or `undefined` when `--list-models` was not requested. */
export const parseListModelsArgs = (args: string[]): AiTool | undefined => {
  const { values } = parseArgs({ args, options: cliOptions, allowPositionals: true });

  if (values['list-models'] !== true) return undefined;

  return parseAiTool(values.tool);
};

export const parseAiFixtureArgs = (args: string[]): AiFixtureCliOptions | undefined => {
  const { positionals, values } = parseArgs({ args, options: cliOptions, allowPositionals: true });

  if (values.help) return undefined;

  if (positionals.length > 3) throw new FixtureError(AI_FIXTURES_USAGE);

  const missingFile = values.missing;

  if (missingFile === '') throw new FixtureError('--missing requires a missing.json file');

  const isMissingMode = missingFile !== undefined;
  const target = positionalsFor(positionals, isMissingMode);
  const fixtureFile = requiredValue(
    values.fixture,
    '--fixture requires an existing JSON fixture file',
    '--fixture invoice.fixture.json'
  );
  const scenario = fixtureScenario(values.scenario, missingFile);
  const typesFile = values.ts;

  if (target.outFile === '') throw new FixtureError('the destination path must not be empty');

  if (typesFile === '') throw new FixtureError('--ts requires a types file');

  const options = toolOptions(values.tool, values.executable, values.timeout, values.model);
  const parsed: AiFixtureCliOptions = { ...target, fixtureFile, scenario, options, typesFile };

  if (missingFile === undefined) return parsed;

  const filling: AiFixtureCliOptions = { ...parsed, missingFile };

  return filling;
};
