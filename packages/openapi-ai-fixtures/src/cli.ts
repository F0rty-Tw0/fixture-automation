#!/usr/bin/env node
import { cliInputs, runCli } from '@fixture-automation/openapi-fixtures';

import { runAiFixturesCli } from './ai-fixtures-cli/feature/ai-fixtures-cli.handler.ts';

await runCli('openapi-ai-fixtures', async (): Promise<void> => runAiFixturesCli(process.argv.slice(2), cliInputs()));
