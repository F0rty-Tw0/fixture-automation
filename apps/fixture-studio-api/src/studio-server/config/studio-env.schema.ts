import { FixtureError } from '@fixture-automation/openapi-fixtures';

import type { StudioArgs, StudioEnv } from '../common/studio-server.type.ts';
import { allowedHosts, allowedOrigins } from '../utils/allowed-origins.util.ts';

const DEFAULT_PORT = 3333;
const MAX_PORT = 65_535;
const DEFAULT_COMPUTE_TIMEOUT_MS = 15_000;
const MAX_TIMER_MS = 2_147_483_647;

const positiveInteger = (name: string, raw: string | undefined, fallback: number, max: number): number => {
  const trimmed = raw?.trim() ?? '';

  if (trimmed === '') return fallback;

  const value = Number(trimmed);
  const isInteger = Number.isSafeInteger(value);
  const isInRange = isInteger && value > 0 && value <= max;

  if (!isInRange)
    throw new FixtureError(
      `${name} must be an integer from 1 to ${max}, got "${raw}"`,
      `unset ${name}, or set it to e.g. ${fallback}`
    );

  return value;
};

/**
 * The API's start-up settings from environment variables and flags, `--port` over `STUDIO_API_PORT`; an invalid value fails with a
 * `FixtureError` before anything listens. `isBundled` (the published package, serving its own UI) drops the Angular dev server origins.
 */
export const studioEnv = (env: Record<string, string | undefined>, args: StudioArgs, isBundled: boolean): StudioEnv => {
  const envPort = positiveInteger('STUDIO_API_PORT', env['STUDIO_API_PORT'], DEFAULT_PORT, MAX_PORT);
  const port = args.port ?? envPort;
  const computeTimeoutMs = positiveInteger(
    'STUDIO_COMPUTE_TIMEOUT_MS',
    env['STUDIO_COMPUTE_TIMEOUT_MS'],
    DEFAULT_COMPUTE_TIMEOUT_MS,
    MAX_TIMER_MS
  );
  const origins = allowedOrigins(env['STUDIO_ALLOWED_ORIGINS'], port, isBundled);
  const hosts = allowedHosts(port, origins);
  const isAiMock = env['STUDIO_AI_MOCK'] === '1';
  const isProduction = env['NODE_ENV'] === 'production';
  const settings: StudioEnv = { port, computeTimeoutMs, allowedOrigins: origins, allowedHosts: hosts, isAiMock, isProduction };

  return settings;
};
