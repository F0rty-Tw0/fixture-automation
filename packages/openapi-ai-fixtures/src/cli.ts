#!/usr/bin/env node
import { runCli } from '@fixture-automation/openapi-fixtures';

import { runAiFixturesCli } from './data-access/ai-fixtures-cli.client.ts';

await runCli('openapi-ai-fixtures', async (): Promise<void> => runAiFixturesCli(process.argv.slice(2)));
