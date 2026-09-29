import { askSchemaName, loadSpec, readJsonFile, readTextFile, schemaTarget } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { aiFixtures } from '../../fixture-enrichment/domain-logic/ai-fixtures.ts';
import { aiMissingFixture } from '../../fixture-enrichment/domain-logic/ai-missing-fixtures.ts';
import { MISSING_SCHEMA_NAME } from '../../missing-values/common/missing.const.ts';
import type { AiMissingRequest, MissingFile } from '../../missing-values/common/missing.type.ts';
import { parseMissingFile } from '../../missing-values/utils/missing-file.util.ts';
import type { ModelDiscoveryOptions, ModelSelection } from '../../model-discovery/common/model.type.ts';
import { selectModel } from '../../model-discovery/domain-logic/model-select.ts';
import type { AiFixtureOptions, AiTool } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { AI_FIXTURES_INPUTS, AI_FIXTURES_USAGE } from '../common/ai-fixtures-cli.const.ts';
import type { AiFixtureCliOptions } from '../common/ai-fixtures-cli.type.ts';
import { createAiProgressReporter } from '../data-access/ai-progress.client.ts';
import { prepareOutput, writeFixtureOutput } from '../data-access/fixture-output.client.ts';
import { requiredValue } from '../utils/ai-fixtures-cli.util.ts';

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

export const generate = async (options: AiFixtureCliOptions, inputs: Inputs): Promise<void> => {
  if (options.missingFile !== undefined) return generateMissing(options, options.missingFile);

  const specUrl = requiredValue(options.specUrl, AI_FIXTURES_USAGE);
  const spec = await loadSpec(specUrl);
  const given = await askSchemaName(spec, options.schemaName, AI_FIXTURES_INPUTS.schemaName, inputs);
  const { schemaName, outFile } = schemaTarget(spec, given, options.outFile);
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
