import { inspect } from 'node:util';
import type { Worker } from 'node:worker_threads';

import type { MissingVerdict } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type {
  DiffTask,
  GenerateTask,
  MergeTask,
  SpecComputeOptions,
  SpecTask,
  SpecTaskOutcome,
  ValidateMissingTask
} from '../common/studio-server.type.ts';
import type { DiffResult, GenerateResult, MergeResult } from '../contract/common/studio-api.type.ts';
import { statusError } from '../utils/status-error.util.ts';

type Settle = (error: unknown, value?: unknown) => void;

const TOO_EXPENSIVE_FIX =
  'pick another endpoint; its schema graph fans out too far or a pattern backtracks, or raise STUDIO_COMPUTE_TIMEOUT_MS';

const tooExpensive = (): FixtureError => statusError(422, 'spec too expensive to sample/validate', TOO_EXPENSIVE_FIX);

const RESTART_FIX = 'restart the API; if it persists, the message above names what the worker sent instead of a task outcome';

/** The message a spec worker posts back; anything else means the running API and the worker file disagree. */
const isOutcome = (message: unknown): message is SpecTaskOutcome => isRecord(message) && typeof message['ok'] === 'boolean';

/** The type and first characters of a message, so an unexpected one is diagnosable from the error alone. */
const messagePreview = (message: unknown): string => {
  const preview = inspect(message, { depth: 2, breakLength: Infinity, maxStringLength: 80 }).slice(0, 200);

  return `${typeof message} ${preview}`;
};

const outcomeError = (outcome: SpecTaskOutcome): unknown => {
  if (outcome.ok) return undefined;

  if (outcome.isFixtureError) return new FixtureError(outcome.message, outcome.fix);

  return new Error(outcome.message);
};

const workerError = (error: Error): Error => {
  const code: unknown = Reflect.get(error, 'code');
  const isOutOfMemory = code === 'ERR_WORKER_OUT_OF_MEMORY';

  if (isOutOfMemory) return tooExpensive();

  return error;
};

const listen = (worker: Worker, signal: AbortSignal, settle: Settle): void => {
  const onMessage = (message: unknown): void => {
    if (!isOutcome(message)) {
      settle(statusError(500, `the spec worker answered with an unexpected message: ${messagePreview(message)}`, RESTART_FIX));

      return;
    }

    const value = message.ok ? message.value : undefined;

    settle(outcomeError(message), value);
  };
  const onError = (error: Error): void => settle(workerError(error));
  const onExit = (code: number): void => settle(new Error(`spec worker exited with code ${code}`));
  const onAbort = (): void => settle(signal.reason);

  worker.once('message', onMessage);
  worker.once('error', onError);
  worker.once('exit', onExit);
  signal.addEventListener('abort', onAbort, { once: true });
};

/** Posts `task` to a loaded worker; the budget starts now, and the worker is terminated however the task ends. */
const runOnWorker = async (worker: Worker, task: SpecTask, options: SpecComputeOptions): Promise<unknown> => {
  const pending = new Promise<unknown>((resolve, reject): void => {
    let isSettled = false;

    const settle: Settle = (error: unknown, value?: unknown): void => {
      if (isSettled) return;

      isSettled = true;
      void worker.terminate();

      if (error === undefined) resolve(value);
      else reject(error);
    };
    const onTimeout = (): void => settle(tooExpensive());

    if (options.signal.aborted) {
      settle(options.signal.reason);

      return;
    }

    let deadline: AbortSignal;

    try {
      deadline = AbortSignal.timeout(options.timeoutMs);
    } catch (error: unknown) {
      settle(error);

      return;
    }

    deadline.addEventListener('abort', onTimeout, { once: true });
    listen(worker, options.signal, settle);
    worker.postMessage(task);
  });

  return pending;
};

/**
 * Runs a spec task in a fresh worker thread capped at 512 MB and `options.timeoutMs`, so a $ref graph that fans out
 * or a backtracking `pattern` fails with a 422 instead of stalling the one event loop. The worker is terminated on
 * completion, timeout, memory exhaustion, and client disconnect.
 */
export function computeInWorker(task: GenerateTask, options: SpecComputeOptions): Promise<GenerateResult>;

export function computeInWorker(task: DiffTask, options: SpecComputeOptions): Promise<DiffResult>;

export function computeInWorker(task: MergeTask, options: SpecComputeOptions): Promise<MergeResult>;

export function computeInWorker(task: ValidateMissingTask, options: SpecComputeOptions): Promise<MissingVerdict>;

export async function computeInWorker(task: SpecTask, options: SpecComputeOptions): Promise<unknown> {
  options.signal.throwIfAborted();

  const worker = await options.workers.take();

  return runOnWorker(worker, task, options);
}
