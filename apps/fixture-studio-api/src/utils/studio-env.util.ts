import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { allowedHosts, allowedOrigins } from './allowed-origins.util.ts';
import type { StudioEnv } from '../common/studio-server.type.ts';

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

  if (!isInRange) throw new FixtureError(`${name} must be an integer from 1 to ${max}, got "${raw}"`, `unset ${name}, or set it to e.g. ${fallback}`);

  return value;
};

/** The API's start-up settings from environment variables; an invalid value fails with a `FixtureError` before anything listens. */
export const studioEnv = (env: Record<string, string | undefined>): StudioEnv => {
  const port = positiveInteger('STUDIO_API_PORT', env['STUDIO_API_PORT'], DEFAULT_PORT, MAX_PORT);
  const computeTimeoutMs = positiveInteger('STUDIO_COMPUTE_TIMEOUT_MS', env['STUDIO_COMPUTE_TIMEOUT_MS'], DEFAULT_COMPUTE_TIMEOUT_MS, MAX_TIMER_MS);
  const origins = allowedOrigins(env['STUDIO_ALLOWED_ORIGINS']);
  const hosts = allowedHosts(port, origins);
  const isAiMock = env['STUDIO_AI_MOCK'] === '1';
  const isProduction = env['NODE_ENV'] === 'production';
  const settings: StudioEnv = { port, computeTimeoutMs, allowedOrigins: origins, allowedHosts: hosts, isAiMock, isProduction };

  return settings;
};
