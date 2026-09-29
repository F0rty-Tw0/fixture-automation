#!/usr/bin/env node
import { cliInputs, runCli } from '@fixture-automation/openapi-fixtures';

import { runTypesCli } from './type-generation/feature/openapi-types-cli.handler.ts';

await runCli('openapi-types', async (): Promise<void> => runTypesCli(process.argv.slice(2), cliInputs()));
