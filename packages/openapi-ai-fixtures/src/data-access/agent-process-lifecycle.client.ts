import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

import { AgentProcessExecution } from './agent-process-execution.client.ts';
import { pipeAgentProcess } from './agent-process-input.client.ts';
import type { AgentProcess } from '../common/agent.type.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';

type SpawnedAgentProcess = ChildProcessByStdio<Writable, Readable, Readable>;
type AgentSettlement = {
  readonly code: number | null;
  readonly executable: string;
  readonly execution: AgentProcessExecution;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (output: string) => void;
  readonly signal: NodeJS.Signals | null;
};

const HEARTBEAT_INTERVAL_MS = 10_000;

const detachAgentProcess = (child: SpawnedAgentProcess): void => {
  child.stdin.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
};

const cancellationError = (reason: unknown): Error => {
  if (reason instanceof Error) return reason;

  return new Error('Agent execution was canceled');
};

const settleAgentProcess = async (settlement: AgentSettlement, endedStatus: string): Promise<void> => {
  try {
    const output = await settlement.execution.result(settlement.executable, settlement.code, settlement.signal);
    const progressError = settlement.execution.reportStatus(endedStatus);

    if (progressError !== undefined) {
      settlement.reject(progressError);

      return;
    }

    settlement.resolve(output);
  } catch (error: unknown) {
    settlement.execution.reportStatus(endedStatus);
    settlement.reject(error);
  }
};

const startAgentProgress = (
  execution: AgentProcessExecution,
  label: string,
  timeoutMs: number,
  lastOutputAt: () => number
): NodeJS.Timeout => {
  const startError = execution.reportStatus(`Started ${label} (time limit ${timeoutMs}ms).\n`);

  if (startError !== undefined) execution.stop(startError);

  const reportQuietHeartbeat = (): void => {
    const lastOutput = lastOutputAt();
    const now = Date.now();
    const quietFor = now - lastOutput;

    if (quietFor < HEARTBEAT_INTERVAL_MS) return;

    const progressError = execution.reportStatus(`The ${label} process is still running.\n`);

    if (progressError !== undefined) execution.stop(progressError);
  };

  return setInterval(reportQuietHeartbeat, HEARTBEAT_INTERVAL_MS);
};

const observeAgentExit = (
  child: SpawnedAgentProcess,
  executable: string,
  execution: AgentProcessExecution,
  finish: (code: number | null, signal: NodeJS.Signals | null) => void
): void => {
  child.once('error', (error: Error): void => {
    execution.stop(new Error(`Failed to start agent "${executable}": ${error.message}`));
    finish(null, null);
  });
  child.once('close', finish);
};

const waitForAgentProcess = async (child: SpawnedAgentProcess, process: AgentProcess, options: AiFixtureOptions): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const signal = options.signal;
  const processLabel = `${options.tool} agent "${process.executable}" (PID ${child.pid ?? 'unknown'})`;
  let isSettled = false;
  let lastOutputAt = Date.now();
  const noteOutput = (): void => {
    lastOutputAt = Date.now();
  };
  const terminationFailed = (error: Error): void => {
    isSettled = true;
    detachAgentProcess(child);
    reject(error);
  };
  const execution = new AgentProcessExecution(child.pid, terminationFailed, noteOutput, options.onProgress);
  let heartbeat: NodeJS.Timeout | undefined;

  if (options.onProgress !== undefined) {
    heartbeat = startAgentProgress(execution, processLabel, process.timeoutMs, (): number => lastOutputAt);
  }

  const abort = (): void => execution.stop(cancellationError(signal?.reason));
  const timeout = setTimeout((): void => {
    execution.stop(new Error(`Agent execution timed out after ${process.timeoutMs}ms`));
  }, process.timeoutMs);
  const finish = (code: number | null, childSignal: NodeJS.Signals | null): void => {
    if (isSettled) return;

    isSettled = true;

    const endedStatus = `The ${processLabel} process ended.\n`;

    const settlement: AgentSettlement = {
      code,
      executable: process.executable,
      execution,
      reject,
      resolve,
      signal: childSignal
    };

    void settleAgentProcess(settlement, endedStatus);
  };

  observeAgentExit(child, process.executable, execution, finish);

  if (signal !== undefined) signal.addEventListener('abort', abort, { once: true });

  const isCanceled = signal?.aborted ?? false;

  try {
    if (isCanceled) abort();
    else pipeAgentProcess(child, process, execution);

    return await promise;
  } finally {
    clearTimeout(timeout);

    clearInterval(heartbeat);

    signal?.removeEventListener('abort', abort);
  }
};

export const runAgentProcess = async (process: AgentProcess, options: AiFixtureOptions): Promise<string> => {
  const child = spawn(process.executable, process.args, {
    cwd: process.scratchDirectory,
    detached: globalThis.process.platform !== 'win32',
    env: process.environment,
    shell: false,
    stdio: 'pipe',
    windowsHide: true
  });
  const output = await waitForAgentProcess(child, process, options);

  return output;
};
