#!/usr/bin/env node
import { FixtureError, printHelp, promptedInputs, runCli } from '@fixture-automation/openapi-fixtures';

import { WIZARD_HELP } from './common/wizard.const.ts';
import { runWizard } from './data-access/wizard.client.ts';

const run = async (): Promise<void> => {
  const [firstArg] = process.argv.slice(2);
  const isHelp = firstArg === '--help' || firstArg === '-h';

  if (isHelp) {
    printHelp(WIZARD_HELP);

    return;
  }

  const isTerminal = process.stdin.isTTY === true;

  if (!isTerminal) throw new FixtureError('the wizard needs a terminal', 'run the individual CLIs instead');

  await runWizard(promptedInputs());
};

await runCli('openapi-fixture-wizard', run);
