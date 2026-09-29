#!/usr/bin/env node
import { cliInputs, runCli } from '@fixture-automation/openapi-fixtures';

import { runFixtureDiffCli } from './fixture-diff-cli/feature/fixture-diff-cli.handler.ts';

await runCli('openapi-fixture-diff', async (): Promise<void> => runFixtureDiffCli(process.argv.slice(2), cliInputs()));
