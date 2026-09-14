import { dirname, join } from 'node:path';

import { MISSING_SCENARIO, parseMissingFile, selectModel } from '@fixture-automation/openapi-ai-fixtures';
import type { AiFixtureOptions, AiMissingRequest, ModelSelection } from '@fixture-automation/openapi-ai-fixtures';
import { readTextFile, writeTextFile } from '@fixture-automation/openapi-fixtures';

import { choose } from './choose.client.ts';
import { TOOLS, WIZARD_INPUTS } from '../common/wizard.const.ts';
import type { DiffResult, WizardContext } from '../common/wizard.type.ts';

const POPULATED_FILE = 'populated.json';

const chooseHarness = async (context: WizardContext): Promise<AiFixtureOptions> => {
  const { question, discover } = context.deps;
  const tool = await choose(question, WIZARD_INPUTS.tool, TOOLS);
  const discovery = await discover(tool);
  const selection: ModelSelection = { tool, interactive: true, discovery, prompt: question };
  const model = await selectModel(selection);
  const options: AiFixtureOptions = { tool, model };

  return options;
};

/** Ask which harness and model to run, fill the diffed fields, and write `populated.json` next to `missing.json`. */
export const fillMissing = async (context: WizardContext, diffed: DiffResult): Promise<string> => {
  const { inputs, deps, schemaName } = context;
  const options = await chooseHarness(context);
  const extraPrompt = await inputs.optional(undefined, WIZARD_INPUTS.extraPrompt);
  const scenario = extraPrompt ?? MISSING_SCENARIO;
  // ponytail: re-read the file just written so the fill sees exactly what the diff CLI would hand it
  const missing = parseMissingFile(await readTextFile('missing', diffed.jsonFile));
  const request: AiMissingRequest = { fixture: diffed.fixture, missing, scenario };
  const filled = await deps.fill(options)(schemaName, request);
  const populatedFile = join(dirname(diffed.jsonFile), POPULATED_FILE);

  await writeTextFile(populatedFile, `${JSON.stringify(filled, null, 2)}\n`);

  return populatedFile;
};
