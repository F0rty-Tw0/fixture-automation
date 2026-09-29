import type { Worker } from 'node:worker_threads';

import type { MissingFile } from '@fixture-automation/openapi-ai-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import type { DiffBody, EnvelopeBody, GenerateBody, MergeBody } from '../../contract/common/studio-api.type.ts';

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
