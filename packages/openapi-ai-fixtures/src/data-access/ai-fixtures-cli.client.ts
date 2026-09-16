import { styleText } from 'node:util';

import { loadSpec, printHelp, readJsonFile, readTextFile, schemaTarget, silentInputs } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { aiFixtures } from './ai-fixtures.client.ts';
import { aiMissingFixture } from './ai-missing-fixtures.client.ts';
import { createAiProgressReporter } from './ai-progress.client.ts';
import { prepareOutput, writeFixtureOutput } from './fixture-output.client.ts';
import { discoverModels } from './model-discovery.client.ts';
import { selectModel } from './model-select.client.ts';
import { AI_FIXTURES_HELP, AI_FIXTURES_USAGE } from '../common/ai-fixtures-cli.const.ts';
import type { AiFixtureCliOptions } from '../common/ai-fixtures-cli.type.ts';
import type { AiFixtureOptions, AiTool } from '../common/ai-fixtures.type.ts';
import { MISSING_SCHEMA_NAME } from '../common/missing.const.ts';
import type { AiMissingRequest, MissingFile } from '../common/missing.type.ts';
import type { ModelDiscoveryOptions, ModelSelection } from '../common/model.type.ts';
import { parseAiFixtureArgs, parseListModelsArgs, requiredValue } from '../utils/ai-fixtures-cli.util.ts';
import { parseMissingFile } from '../utils/missing-file.util.ts';

const listModels = async (options: AiFixtureOptions): Promise<void> => {
  const { tool } = options;
  const discovery = await discoverModels(tool, options);

  for (const model of discovery.models) process.stdout.write(`${model}\n`);

  const source = styleText('cyan', `source: ${discovery.source}\n`, { stream: process.stderr });

  process.stderr.write(source);
};

const modelSelection = (tool: AiTool, requested: string | undefined, discoveryOptions: ModelDiscoveryOptions): ModelSelection => {
  const interactive = process.stdin.isTTY === true;
  const selection: ModelSelection = { tool, interactive, discoveryOptions };

  if (requested === undefined) return selection;

  const withRequest: ModelSelection = { ...selection, requested };

  return withRequest;
};

const resolveModel = async (options: AiFixtureOptions): Promise<AiFixtureOptions> => {
  const selection = modelSelection(options.tool, options.model, options);
  const model = await selectModel(selection);
  const resolved: AiFixtureOptions = { ...options, model };

  return resolved;
};

/** Reads and validates `--missing` before any harness runs, so a bad file fails fast. */
const missingInput = async (file: string): Promise<MissingFile> => {
  const text = await readTextFile('--missing', file);
  const missing = parseMissingFile(text);

  return missing;
};

/** Fill the projection in `missing.json`; it names the schema, so neither spec nor name is asked for. */
const generateMissing = async (options: AiFixtureCliOptions, missingFile: string): Promise<void> => {
  const fixture = await readJsonFile('--fixture', options.fixtureFile);
  const target = await prepareOutput(options);
  const missing = await missingInput(missingFile);
  const tool = await resolveModel(options.options);
  const onProgress = createAiProgressReporter();
  const agentOptions: AiFixtureOptions = { ...tool, recoveryFile: target.file ?? options.fixtureFile, onProgress };
  const fill = aiMissingFixture(agentOptions);
  const missingRequest: AiMissingRequest = { fixture, missing, scenario: options.scenario };
  const filled = await fill(missing.schemaName, missingRequest);

  await writeFixtureOutput(target, MISSING_SCHEMA_NAME, filled);
};

const generate = async (options: AiFixtureCliOptions): Promise<void> => {
  if (options.missingFile !== undefined) return generateMissing(options, options.missingFile);

  const specUrl = requiredValue(options.specUrl, AI_FIXTURES_USAGE);
  const spec = await loadSpec(specUrl);
  const { schemaName, outFile } = schemaTarget(spec, options.schemaName, options.outFile);
  const resolved: AiFixtureCliOptions = { ...options, schemaName, outFile };
  const fixture = await readJsonFile('--fixture', options.fixtureFile);
  const target = await prepareOutput(resolved);
  const tool = await resolveModel(options.options);
  const onProgress = createAiProgressReporter();
  const agentOptions: AiFixtureOptions = { ...tool, recoveryFile: target.file ?? options.fixtureFile, onProgress };
  const enrich = aiFixtures(spec, agentOptions);
  const request = { fixture, scenario: options.scenario };
  const enriched = await enrich(schemaName, request);

  await writeFixtureOutput(target, schemaName, enriched);
};

export const runAiFixturesCli = async (args: string[], inputs: Inputs = silentInputs): Promise<void> => {
  const listedTool = parseListModelsArgs(args);

  if (listedTool !== undefined) {
    await listModels(listedTool);

    return;
  }

  const options = await parseAiFixtureArgs(args, inputs);

  if (options === undefined) {
    printHelp(AI_FIXTURES_HELP);

    return;
  }

  await generate(options);
};
