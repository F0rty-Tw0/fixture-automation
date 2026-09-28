import type { Worker } from 'node:worker_threads';

import type {
  AiFixtureOptions,
  AiFixtureProgress,
  AiMissingFactory,
  AiToolInstall,
  MissingFile,
  ModelDiscovery,
  ModelDiscoveryOptions
} from '@fixture-automation/openapi-ai-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import type { FastifyServerOptions } from 'fastify';

import type { AiTool, ApiErrorBody, DiffBody, EnvelopeBody, GenerateBody, MergeBody } from '../contract/common/studio-api.type.ts';

type StudioLogger = NonNullable<FastifyServerOptions['logger']>;

/** The AI entry points of `openapi-ai-fixtures`, injected so tests and `STUDIO_AI_MOCK` never spawn a paid CLI. */
export type StudioAi = {
  readonly fill: (options: AiFixtureOptions) => AiMissingFactory;
  readonly discover: (tool: AiTool, options: ModelDiscoveryOptions) => Promise<ModelDiscovery>;
  /** Which CLIs are on `PATH`; reads files only, never starts a CLI. */
  readonly detect: () => Promise<AiToolInstall[]>;
  /** True for `STUDIO_AI_MOCK=1`, whose answers come from no CLI at all. */
  readonly isMock: boolean;
};

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

/** Loaded specs by id, shared by every route of one server. */
export type SpecStore = {
  add(spec: OpenApiSpec): string;
  /** The cached spec, or a 404 `FixtureError`. */
  require(specId: string): OpenApiSpec;
};

export type ErrorReply = {
  readonly statusCode: number;
  readonly body: ApiErrorBody;
};

/** One AI fill, started by the NDJSON stream with its abort signal and progress sink. */
export type AiFillJob = (signal: AbortSignal, onProgress: (progress: AiFixtureProgress) => void) => Promise<Record<string, unknown>>;

export type GenerateTask = {
  readonly name: 'generate';
  readonly spec: OpenApiSpec;
  readonly body: GenerateBody;
};

export type DiffTask = {
  readonly name: 'diff';
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly body: DiffBody;
};

export type EnvelopeTask = {
  readonly name: 'envelope';
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly body: EnvelopeBody;
};

export type MergeTask = {
  readonly name: 'merge';
  readonly spec: OpenApiSpec;
  readonly schemaName: string;
  readonly body: MergeBody;
};

/** Judges an AI fill against its missing projection, whose `pattern`s may backtrack. */
export type ValidateMissingTask = {
  readonly name: 'validate-missing';
  readonly missing: MissingFile;
  readonly value: unknown;
};

/** Spec-driven CPU work that runs in a worker thread, so a hostile spec cannot stall the server. */
export type SpecTask = DiffTask | EnvelopeTask | GenerateTask | MergeTask | ValidateMissingTask;

type SpecTaskSuccess = {
  readonly ok: true;
  readonly value: unknown;
};

type SpecTaskFailure = {
  readonly ok: false;
  readonly message: string;
  readonly fix: string | undefined;
  /** True when the worker threw a `FixtureError`, which becomes a 400 again on this side. */
  readonly isFixtureError: boolean;
};

/** The single message a spec worker posts back. */
export type SpecTaskOutcome = SpecTaskFailure | SpecTaskSuccess;

/** Hands out loaded spec workers, one per task. */
type SpecWorkerSource = {
  take(): Promise<Worker>;
};

/** What the spec routes need to run tasks off the event loop. */
export type SpecCompute = {
  readonly workers: SpecWorkerSource;
  readonly timeoutMs: number;
};

type ComputeSignal = {
  /** Aborted when the client disconnects; the worker is terminated. */
  readonly signal: AbortSignal;
};

export type SpecComputeOptions = ComputeSignal & SpecCompute;
