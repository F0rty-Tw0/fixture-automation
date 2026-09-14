#!/usr/bin/env node
import { runCli } from '@fixture-automation/openapi-fixtures';

import { runFixtureDiffCli } from './data-access/fixture-diff-cli.client.ts';

await runCli('openapi-fixture-diff', async (): Promise<void> => runFixtureDiffCli(process.argv.slice(2)));
