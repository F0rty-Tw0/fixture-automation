import { styleText } from 'node:util';

import { terminalQuestion } from '@fixture-automation/openapi-fixtures';

import { discoverModels } from './model-discovery.client.ts';
import type { AiTool } from '../common/ai-fixtures.type.ts';
import type { ModelSelection } from '../common/model.type.ts';
import { DEFAULT_MODEL } from '../utils/model-flag.util.ts';

const PROMPT_ATTEMPTS = 3;
const QUESTION = 'model number: ';

const printModels = (tool: AiTool, models: string[]): void => {
  const heading = styleText(['bold', 'cyan'], `${tool} models:`, { stream: process.stderr });
  const defaultChoice = styleText('cyan', '0', { stream: process.stderr });

  console.error(heading);
  console.error(`  ${defaultChoice}) harness default`);

  let position = 1;

  for (const model of models) {
    const choice = styleText('cyan', String(position), { stream: process.stderr });

    console.error(`  ${choice}) ${model}`);
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

const askForModel = async (selection: ModelSelection, models: string[]): Promise<string> => {
  const ask = selection.prompt ?? terminalQuestion;

  printModels(selection.tool, models);

  for (let attempt = 0; attempt < PROMPT_ATTEMPTS; attempt += 1) {
    const answer = await ask(QUESTION);
    const model = chosenModel(answer, models);

    if (model !== undefined) return model;

    const retry = styleText('yellow', 'enter a listed number, or 0 for the harness default', {
      stream: process.stderr
    });

    console.error(retry);
  }

  throw new Error(`no model was selected after ${PROMPT_ATTEMPTS} attempts`);
};

const warnUnlisted = (tool: AiTool, requested: string, models: string[]): void => {
  const isListed = models.includes(requested);
  const isKnown = requested === DEFAULT_MODEL || isListed;

  if (isKnown) return;

  const warning = styleText('yellow', `unlisted ${tool} model "${requested}"; passing it to the CLI unchanged`, {
    stream: process.stderr
  });

  console.error(warning);
};

/** Resolve the model to pass to a harness: an explicit request, an interactive pick, or its default. */
export const selectModel = async (selection: ModelSelection): Promise<string> => {
  const { tool, requested, discovery } = selection;

  if (requested !== undefined) {
    if (discovery !== undefined) warnUnlisted(tool, requested, discovery.models);

    return requested;
  }

  if (selection.interactive) {
    const catalog = discovery ?? (await discoverModels(tool, selection.discoveryOptions));

    return askForModel(selection, catalog.models);
  }

  const notice = styleText('yellow', `no --model given; using the ${tool} harness default`, {
    stream: process.stderr
  });

  console.error(notice);

  return DEFAULT_MODEL;
};
