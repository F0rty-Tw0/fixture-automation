#!/usr/bin/env node
import { runCli } from './cli/feature/cli-runner.handler.ts';
import { runFixturesCli } from './cli/feature/fixtures-cli.handler.ts';
import { cliInputs } from './prompt/domain-logic/prompted-inputs.ts';

await runCli('openapi-fixtures', async (): Promise<void> => runFixturesCli(process.argv.slice(2), cliInputs()));
