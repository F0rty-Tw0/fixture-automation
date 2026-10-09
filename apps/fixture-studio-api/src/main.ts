import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { aiMissingFixture, detectAiTools, discoverModels } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { FastifyInstance } from 'fastify';

import type { StudioAi } from './ai/common/ai.type.ts';
import { MOCK_AI } from './ai/data-access/ai-mock.client.ts';
import { buildServer } from './server.ts';
import type { StudioArgs, StudioEnv } from './studio-server/common/studio-server.type.ts';
import { studioArgs } from './studio-server/config/studio-args.schema.ts';
import { studioEnv } from './studio-server/config/studio-env.schema.ts';
import { studioLogger } from './studio-server/config/studio-logger.config.ts';
import { openBrowser } from './studio-server/data-access/open-browser.client.ts';

const HOST = '127.0.0.1';
const CLI_AI: StudioAi = { fill: aiMissingFixture, discover: discoverModels, detect: detectAiTools, isMock: false };
/** Present only in the published package, which ships the built UI next to this module. */
const UI_INDEX = fileURLToPath(new URL('./ui/index.html', import.meta.url));
/** The spec worker the package build emits next to this module; the bundle has no `spec-compute/feature/` folder. */
const SPEC_WORKER_URL = new URL('./spec-compute.worker.js', import.meta.url);

type StudioSettings = {
  readonly env: StudioEnv;
  readonly args: StudioArgs;
};

/** The settings from the environment and flags, or `undefined` after printing why they are invalid in the CLIs' `what` / `fix` form. */
const readSettings = (isBundled: boolean): StudioSettings | undefined => {
  try {
    const args = studioArgs(process.argv.slice(2));
    const env = studioEnv(process.env, args, isBundled);
    const settings: StudioSettings = { env, args };

    return settings;
  } catch (error: unknown) {
    if (!(error instanceof FixtureError)) throw error;

    const lines = [`fixture-studio-api: ${error.message}`];

    if (error.fix !== undefined) lines.push(`  fix: ${error.fix}`);

    process.stderr.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;

    return undefined;
  }
};

/** Prints the bundled UI's URL and, unless `--no-open`, opens it; a missing browser only logs a warning. */
const announceUi = (fastify: FastifyInstance, url: string, args: StudioArgs): void => {
  process.stdout.write(`Fixture Studio: ${url}\n`);

  if (!args.isOpen) return;

  const warnNoBrowser = (error: Error): void => {
    fastify.log.warn({ err: error }, 'could not open a browser; open the URL yourself');
  };

  openBrowser(url, warnNoBrowser);
};

const start = async (env: StudioEnv, args: StudioArgs, isBundled: boolean): Promise<void> => {
  const logger = studioLogger({ isProduction: env.isProduction, isBundled });
  const ai = env.isAiMock ? MOCK_AI : CLI_AI;
  const { allowedOrigins, allowedHosts, computeTimeoutMs } = env;
  const bundledFiles = { uiRoot: dirname(UI_INDEX), specWorkerUrl: SPEC_WORKER_URL };
  const sourceFiles = {};
  const fileOptions = isBundled ? bundledFiles : sourceFiles;
  const fastify = buildServer({ allowedOrigins, allowedHosts, logger, ai, computeTimeoutMs, warmSpecWorker: true, ...fileOptions });

  const close = (): void => {
    void fastify.close();
  };

  process.once('SIGINT', close);
  process.once('SIGTERM', close);

  if (env.isAiMock) fastify.log.warn('STUDIO_AI_MOCK=1: AI routes answer with canned progress and sampled values; no CLI runs');

  try {
    await fastify.listen({ host: HOST, port: env.port });
  } catch (error: unknown) {
    fastify.log.error({ err: error }, 'Fixture Studio API failed to start');
    process.exitCode = 1;
    await fastify.close();

    return;
  }

  if (isBundled) announceUi(fastify, `http://${HOST}:${env.port}`, args);
};

const isBundled = existsSync(UI_INDEX);
const settings = readSettings(isBundled);

if (settings !== undefined) await start(settings.env, settings.args, isBundled);
