import { FixtureError, loadSpec, readJsonFile, resolveSchemaName, writeTextFile } from '@fixture-automation/openapi-fixtures';

import { diffFixture } from './fixture-diff.client.ts';
import { writeMissingFiles } from './missing-files.client.ts';
import { FIXTURE_DIFF_HELP, FIXTURE_DIFF_USAGE } from '../common/fixture-diff-cli.const.ts';
import { dropPaths } from '../utils/drop-path.util.ts';
import { parseCorruptArgs, parseDiffArgs } from '../utils/fixture-diff-cli.util.ts';

const printHelp = (): void => {
  process.stdout.write(`${FIXTURE_DIFF_HELP}\n`);
};

const runCorrupt = async (args: string[]): Promise<void> => {
  const parsed = parseCorruptArgs(args);

  if (parsed === undefined) {
    printHelp();

    return;
  }

  const fixture = await readJsonFile('fixture', parsed.fixtureFile);
  const corrupted = dropPaths(fixture, parsed.paths);

  await writeTextFile(parsed.outFile, `${JSON.stringify(corrupted, null, 2)}\n`);
};

const runDiff = async (args: string[]): Promise<void> => {
  const parsed = parseDiffArgs(args);

  if (parsed === undefined) {
    printHelp();

    return;
  }

  const { specUrl, fixtureFile, outDir, requiredOnly } = parsed;
  const spec = await loadSpec(specUrl);
  const schemaName = resolveSchemaName(spec, parsed.schemaName);
  const fixture = await readJsonFile('--fixture', fixtureFile);
  const diff = diffFixture({ spec, schemaName, fixture, requiredOnly });

  await writeMissingFiles(diff, outDir);

  if (!diff.paths.length) console.error('no missing fields');
};

export const runFixtureDiffCli = async (args: string[]): Promise<void> => {
  const [command, ...rest] = args;
  const isHelp = command === undefined || command === '--help' || command === '-h';

  if (isHelp) {
    printHelp();

    return;
  }

  if (command === 'corrupt') return runCorrupt(rest);

  if (command === 'diff') return runDiff(rest);

  throw new FixtureError(FIXTURE_DIFF_USAGE);
};
