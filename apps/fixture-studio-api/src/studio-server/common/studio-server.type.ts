import type { FastifyInstance, FastifyServerOptions } from 'fastify';

import type { StudioAi } from '../../ai/common/ai.type.ts';
import type { ApiErrorBody } from '../../contract/common/studio-api.type.ts';

export type StudioLogger = NonNullable<FastifyServerOptions['logger']>;

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
  /** Absolute path of the built UI, served at `/`; set only in bundled mode. */
  readonly uiRoot?: string;
  /** The spec worker module the bundled package ships next to its main module; unset, the one beside the sources runs. */
  readonly specWorkerUrl?: URL;
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

/** The `fixture-studio` command-line flags. */
export type StudioArgs = {
  readonly port: number | undefined;
  /** False for `--no-open`. */
  readonly isOpen: boolean;
};

/** Opens `url` in the default browser; a failure goes to `onError` instead of throwing. */
type BrowserOpener = (url: string, onError: (error: Error) => void) => void;

/** Writes text to standard output. */
type StdoutWriter = (text: string) => void;

/** What starting the API needs; the browser opener and stdout are injected so a spec can watch them. */
export type StudioLaunch = {
  readonly fastify: FastifyInstance;
  readonly port: number;
  /** The published package, which serves its own UI and so announces its URL. */
  readonly isBundled: boolean;
  /** False for `--no-open`. */
  readonly isOpen: boolean;
  readonly openBrowser: BrowserOpener;
  readonly writeStdout: StdoutWriter;
};

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
