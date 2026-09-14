#!/usr/bin/env node
import { runCli } from './data-access/cli-runner.client.ts';
import { runFixturesCli } from './data-access/fixtures-cli.client.ts';
import { cliInputs } from './data-access/input-prompt.client.ts';

await runCli('openapi-fixtures', async (): Promise<void> => runFixturesCli(process.argv.slice(2), cliInputs()));
