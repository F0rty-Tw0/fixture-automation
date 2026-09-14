#!/usr/bin/env node
import { cliInputs, runCli } from '@fixture-automation/openapi-fixtures';

import { runFixtureMergeCli } from './data-access/fixture-merge-cli.client.ts';

await runCli('openapi-fixture-merge', async (): Promise<void> => runFixtureMergeCli(process.argv.slice(2), cliInputs()));
