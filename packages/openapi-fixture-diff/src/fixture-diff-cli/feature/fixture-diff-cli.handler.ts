import { styleText } from 'node:util';

import {
  FixtureError,
  askSchemaName,
  loadSpec,
  printHelp,
  readJsonFile,
  resolveSchemaName,
  silentInputs,
  writeTextFile
} from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { parseCorruptArgs, parseDiffArgs } from './fixture-diff-cli-args.ts';
import { diffFixture } from '../../fixture-diff/domain-logic/fixture-diff.ts';
import { writeBaselineFile, writeMissingFiles } from '../../fixture-diff/domain-logic/missing-files.ts';
import { dropPaths } from '../../shared/fixture-path/utils/drop-path.util.ts';
import { DIFF_INPUTS, FIXTURE_DIFF_HELP, FIXTURE_DIFF_USAGE } from '../common/fixture-diff-cli.const.ts';

const runCorrupt = async (args: string[], inputs: Inputs): Promise<void> => {
  const parsed = await parseCorruptArgs(args, inputs);

  if (parsed === undefined) {
    printHelp(FIXTURE_DIFF_HELP);

    return;
  }

  const fixture = await readJsonFile('fixture', parsed.fixtureFile);
  const corrupted = dropPaths(fixture, parsed.paths);

  await writeTextFile(parsed.outFile, `${JSON.stringify(corrupted, null, 2)}\n`);
};

const runDiff = async (args: string[], inputs: Inputs): Promise<void> => {
  const parsed = await parseDiffArgs(args, inputs);

  if (parsed === undefined) {
    printHelp(FIXTURE_DIFF_HELP);

    return;
  }

  const { specUrl, fixtureFile, outDir, requiredOnly, replacePlaceholders, objectShape } = parsed;
  const spec = await loadSpec(specUrl);
  const given = await askSchemaName(spec, parsed.schemaName, DIFF_INPUTS.schemaName, inputs);
  const schemaName = resolveSchemaName(spec, given);
  const fixture = await readJsonFile('--fixture', fixtureFile);
  const diff = diffFixture({ spec, schemaName, fixture, requiredOnly, objectShape, replacePlaceholders });

  await writeMissingFiles(diff, outDir);

  if (replacePlaceholders) await writeBaselineFile(diff, outDir);

  if (!diff.paths.length) console.error(styleText('green', 'no missing fields', { stream: process.stderr }));
};

export const runFixtureDiffCli = async (args: string[], inputs: Inputs = silentInputs): Promise<void> => {
  const [firstArg, ...rest] = args;
  const isHelp = firstArg === '--help' || firstArg === '-h';

  if (isHelp) {
    printHelp(FIXTURE_DIFF_HELP);

    return;
  }

  const command = firstArg ?? (await inputs.required(undefined, DIFF_INPUTS.command, FIXTURE_DIFF_USAGE));

  if (command === 'corrupt') return runCorrupt(rest, inputs);

  if (command === 'diff') return runDiff(rest, inputs);

  throw new FixtureError(FIXTURE_DIFF_USAGE);
};
