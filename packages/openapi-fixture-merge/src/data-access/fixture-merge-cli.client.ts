import { printHelp, silentInputs } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { mergeFixture } from './fixture-merge.client.ts';
import { MERGE_HELP } from '../common/fixture-merge-cli.const.ts';
import { parseMergeArgs } from '../utils/fixture-merge-cli.util.ts';

export const runFixtureMergeCli = async (args: string[], inputs: Inputs = silentInputs): Promise<void> => {
  const input = await parseMergeArgs(args, inputs);

  if (input === undefined) {
    printHelp(MERGE_HELP);

    return;
  }

  await mergeFixture(input);
};
