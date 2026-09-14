#!/usr/bin/env node
import { cliInputs, runCli } from '@fixture-automation/openapi-fixtures';

import { runTypesCli } from './data-access/openapi-types-cli.client.ts';

await runCli('openapi-types', async (): Promise<void> => runTypesCli(process.argv.slice(2), cliInputs()));
