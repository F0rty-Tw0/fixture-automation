import { styleText } from 'node:util';

import { printHelp, silentInputs } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { discoverModels } from '../../model-discovery/domain-logic/model-discovery.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { AI_FIXTURES_HELP } from '../common/ai-fixtures-cli.const.ts';
import { generate } from '../domain-logic/fixture-generation.ts';
import { parseAiFixtureArgs, parseListModelsArgs } from '../utils/ai-fixtures-cli.util.ts';

const listModels = async (options: AiFixtureOptions): Promise<void> => {
  const { tool } = options;
  const discovery = await discoverModels(tool, options);

  for (const model of discovery.models) process.stdout.write(`${model}\n`);

  const source = styleText('cyan', `source: ${discovery.source}\n`, { stream: process.stderr });

  process.stderr.write(source);
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

  await generate(options, inputs);
};
