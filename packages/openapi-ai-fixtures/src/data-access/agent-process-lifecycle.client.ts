import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

import { AgentProcessExecution } from './agent-process-execution.client.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';

type AgentProcess = {
  readonly args: string[];
  readonly environment: NodeJS.ProcessEnv;
  readonly executable: string;
  readonly input: string;
  readonly scratchDirectory: string;
  readonly timeoutMs: number;
};

type SpawnedAgentProcess = ChildProcessByStdio<Writable, Readable, Readable>;
type AgentSettlement = {
  readonly code: number | null;
  readonly executable: string;
  readonly execution: AgentProcessExecution;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (output: string) => void;
  readonly signal: NodeJS.Signals | null;
};

const detachAgentProcess = (child: SpawnedAgentProcess): void => {
  child.stdin.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
};

const pipeAgentProcess = (child: SpawnedAgentProcess, input: string, execution: AgentProcessExecution): void => {
  child.stdout.on('data', (chunk: Buffer): void => execution.receiveOutput(chunk, 'stdout'));
  child.stderr.on('data', (chunk: Buffer): void => execution.receiveOutput(chunk, 'stderr'));
  child.stdin.once('error', (error: Error): void => {
    execution.stop(new Error(`Agent stdin failed: ${error.message}`));
  });
  child.stdin.end(input);
};

const cancellationError = (reason: unknown): Error => {
  if (reason instanceof Error) return reason;

  return new Error('Agent execution was canceled');
};

const settleAgentProcess = async (settlement: AgentSettlement): Promise<void> => {
  try {
    const output = await settlement.execution.result(settlement.executable, settlement.code, settlement.signal);

    settlement.resolve(output);
  } catch (error: unknown) {
    settlement.reject(error);
  }
};

const waitForAgentProcess = async (child: SpawnedAgentProcess, process: AgentProcess, options: AiFixtureOptions): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const signal = options.signal;
  let isSettled = false;
  const execution = new AgentProcessExecution(child.pid, (error): void => {
    isSettled = true;
    detachAgentProcess(child);
    reject(error);
  });
  const abort = (): void => execution.stop(cancellationError(signal?.reason));
  const timeout = setTimeout((): void => {
    execution.stop(new Error(`Agent execution timed out after ${process.timeoutMs}ms`));
  }, process.timeoutMs);
  const finish = (code: number | null, childSignal: NodeJS.Signals | null): void => {
    if (isSettled) return;

    isSettled = true;
    const settlement: AgentSettlement = {
      code,
      executable: process.executable,
      execution,
      reject,
      resolve,
      signal: childSignal
    };

    void settleAgentProcess(settlement);
  };

  child.once('error', (error: Error): void => {
    execution.stop(new Error(`Failed to start agent "${process.executable}": ${error.message}`));
    finish(null, null);
  });
  child.once('close', finish);

  if (signal !== undefined) signal.addEventListener('abort', abort, { once: true });

  const isCanceled = signal?.aborted ?? false;

  try {
    if (isCanceled) abort();
    else pipeAgentProcess(child, process.input, execution);

    return await promise;
  } finally {
    clearTimeout(timeout);
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
