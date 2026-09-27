import { aiMissingFixture, detectAiTools, discoverModels } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import type { StudioAi, StudioEnv } from './common/studio-server.type.ts';
import { MOCK_AI } from './data-access/ai-mock.client.ts';
import { buildServer } from './server.ts';
import { studioEnv } from './utils/studio-env.util.ts';

const HOST = '127.0.0.1';
const CLI_AI: StudioAi = { fill: aiMissingFixture, discover: discoverModels, detect: detectAiTools, isMock: false };
const printOptions = { all: true, relativeUrl: true, translateTime: 'SYS:HH:MM:ss' };
const prettyTransport = { target: 'pino-http-print', options: printOptions };
const developmentLogger = { level: 'debug', transport: prettyTransport };
const productionLogger = { level: 'info' };

/** The settings, or `undefined` after printing why they are invalid in the CLIs' `what` / `fix` form. */
const readEnv = (): StudioEnv | undefined => {
  try {
    return studioEnv(process.env);
  } catch (error: unknown) {
    if (!(error instanceof FixtureError)) throw error;

    const lines = [`fixture-studio-api: ${error.message}`];

    if (error.fix !== undefined) lines.push(`  fix: ${error.fix}`);

    process.stderr.write(`${lines.join('\n')}\n`);
    process.exitCode = 1;

    return undefined;
  }
};

const start = async (env: StudioEnv): Promise<void> => {
  const logger = env.isProduction ? productionLogger : developmentLogger;
  const ai = env.isAiMock ? MOCK_AI : CLI_AI;
  const { allowedOrigins, allowedHosts, computeTimeoutMs } = env;
  const fastify = buildServer({ allowedOrigins, allowedHosts, logger, ai, computeTimeoutMs, warmSpecWorker: true });

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
  }
};

const env = readEnv();

if (env !== undefined) await start(env);
