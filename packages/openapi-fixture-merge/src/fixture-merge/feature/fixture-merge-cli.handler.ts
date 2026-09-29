import { styleText } from 'node:util';

import { printHelp, silentInputs } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { parseMergeArgs } from './fixture-merge-cli-args.ts';
import { MERGE_HELP } from '../common/fixture-merge-cli.const.ts';
import { mergeFixture } from '../domain-logic/fixture-merge.ts';

export const runFixtureMergeCli = async (args: string[], inputs: Inputs = silentInputs): Promise<void> => {
  const input = await parseMergeArgs(args, inputs);

  if (input === undefined) {
    printHelp(MERGE_HELP);

    return;
  }

  const result = await mergeFixture(input);

  console.error(styleText('green', `wrote ${result.outFile}`, { stream: process.stderr }));
  console.error(styleText('green', `wrote ${result.provenanceFile}`, { stream: process.stderr }));
};
