import type { FastifyServerOptions } from 'fastify';

import type { StudioAi } from '../../ai/common/ai.type.ts';
import type { ApiErrorBody } from '../../contract/common/studio-api.type.ts';

type StudioLogger = NonNullable<FastifyServerOptions['logger']>;

/** Which callers may reach the API at all. */
export type RequestAccess = {
  /** Browser origins allowed to call the API; a request without an `Origin` header is judged by `Sec-Fetch-Site`. */
  readonly allowedOrigins: string[];
  /** Lower-case `Host` header values the API answers (`host:port`). */
  readonly allowedHosts: string[];
};

type ServerRuntime = {
  readonly logger: StudioLogger;
  readonly ai: StudioAi;
  /** Wall-clock budget of one sampling or validation task, counted from when its worker gets it, before a 422. */
  readonly computeTimeoutMs: number;
  /** Load a spec worker at start-up so the first diff or merge is fast; tests leave it off. */
  readonly warmSpecWorker: boolean;
};

export type StudioServerOptions = RequestAccess & ServerRuntime;

type EnvSettings = {
  readonly port: number;
  readonly computeTimeoutMs: number;
  /** `STUDIO_AI_MOCK=1`: canned AI instead of paid CLI runs. */
  readonly isAiMock: boolean;
  readonly isProduction: boolean;
};

/** Start-up settings read from the environment. */
export type StudioEnv = EnvSettings & RequestAccess;

/** The request headers the access guard judges. */
export type RequestIdentity = {
  readonly host: string | undefined;
  readonly origin: string | undefined;
  readonly fetchSite: string | string[] | undefined;
};

export type ErrorReply = {
  readonly statusCode: number;
  readonly body: ApiErrorBody;
};
