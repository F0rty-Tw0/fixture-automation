import { mergeFixture } from './fixture-merge.client.ts';
import { MERGE_HELP } from '../common/fixture-merge-cli.const.ts';
import { parseMergeArgs } from '../utils/fixture-merge-cli.util.ts';

export const runFixtureMergeCli = async (args: string[]): Promise<void> => {
  const input = parseMergeArgs(args);

  if (input === undefined) {
    process.stdout.write(`${MERGE_HELP}\n`);

    return;
  }

  await mergeFixture(input);
};
