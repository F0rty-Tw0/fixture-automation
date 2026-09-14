import { terminalQuestion } from '@fixture-automation/openapi-fixtures';

import type { AiTool } from '../common/ai-fixtures.type.ts';
import type { ModelSelection } from '../common/model.type.ts';
import { DEFAULT_MODEL } from '../utils/model-flag.util.ts';

const PROMPT_ATTEMPTS = 3;
const QUESTION = 'model number: ';

const printModels = (tool: AiTool, models: string[]): void => {
  console.error(`${tool} models:`);
  console.error('  0) harness default');

  let position = 1;

  for (const model of models) {
    console.error(`  ${position}) ${model}`);
    position += 1;
  }
};

const chosenModel = (answer: string, models: string[]): string | undefined => {
  const trimmed = answer.trim();
  const position = Number(trimmed);
  const isWhole = Number.isInteger(position);

  if (trimmed.length === 0 || !isWhole) return undefined;

  if (position === 0) return DEFAULT_MODEL;

  return models[position - 1];
};

const askForModel = async (selection: ModelSelection): Promise<string> => {
  const ask = selection.prompt ?? terminalQuestion;
  const { models } = selection.discovery;

  printModels(selection.tool, models);

  for (let attempt = 0; attempt < PROMPT_ATTEMPTS; attempt += 1) {
    const answer = await ask(QUESTION);
    const model = chosenModel(answer, models);

    if (model !== undefined) return model;

    console.error('enter a listed number, or 0 for the harness default');
  }

  throw new Error(`no model was selected after ${PROMPT_ATTEMPTS} attempts`);
};

const warnUnlisted = (tool: AiTool, requested: string, models: string[]): void => {
  const isListed = models.includes(requested);
  const isKnown = requested === DEFAULT_MODEL || isListed;

  if (isKnown) return;

  console.error(`unlisted ${tool} model "${requested}"; passing it to the CLI unchanged`);
};

/** Resolve the model to pass to a harness: an explicit request, an interactive pick, or its default. */
export const selectModel = async (selection: ModelSelection): Promise<string> => {
  const { tool, requested, discovery } = selection;

  if (requested !== undefined) {
    warnUnlisted(tool, requested, discovery.models);

    return requested;
  }

  if (selection.interactive) return askForModel(selection);

  console.error(`no --model given; using the ${tool} harness default`);

  return DEFAULT_MODEL;
};
