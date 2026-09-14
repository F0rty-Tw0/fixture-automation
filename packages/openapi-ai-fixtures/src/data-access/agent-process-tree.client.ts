import { spawn } from 'node:child_process';
import { isAbsolute, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { AgentTerminationError } from './agent-process-termination.error.ts';

const taskkillPath = (): string => {
  const systemRoot = process.env['SystemRoot'];

  if (!systemRoot) throw new Error('SystemRoot is unavailable');

  const isAbsoluteRoot = isAbsolute(systemRoot);

  if (!isAbsoluteRoot) throw new Error('SystemRoot must be absolute');

  return join(systemRoot, 'System32', 'taskkill.exe');
};

const signalProcess = (pid: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(pid, signal);

    return true;
  } catch (error: unknown) {
    const isMissing = error instanceof Error && 'code' in error && error.code === 'ESRCH';

    if (isMissing) return false;

    throw error;
  }
};

const taskkillProcessTree = async (taskkill: string, pid: number): Promise<void> => {
  const killer = spawn(taskkill, ['/pid', `${pid}`, '/t', '/f'], {
    stdio: 'ignore',
    windowsHide: true
  });

  await new Promise<void>((resolve, reject): void => {
    let isComplete = false;
    const timer = setTimeout((): void => {
      isComplete = true;
      killer.unref();

      try {
        killer.kill('SIGKILL');
      } catch (error: unknown) {
        reject(new Error('Unable to stop stalled taskkill', { cause: error }));

        return;
      }

      reject(new Error('taskkill did not finish within 5000ms'));
    }, 5_000);
    const complete = (error: Error | undefined): void => {
      if (isComplete) return;

      isComplete = true;
      clearTimeout(timer);

      if (error !== undefined) reject(error);
      else resolve();
    };

    killer.on('error', complete);
    killer.once('close', (code: number | null): void => {
      if (code === 0) complete(undefined);
      else complete(new Error(`taskkill exited with code ${code}`));
    });
  });
};

const terminateWindowsTree = async (pid: number): Promise<void> => {
  const taskkill = taskkillPath();

  await taskkillProcessTree(taskkill, pid);
};

const terminatePosixTree = async (pid: number): Promise<void> => {
  const wasRunning = signalProcess(-pid, 'SIGTERM');

  if (!wasRunning) return;

  await delay(250);
  signalProcess(-pid, 'SIGKILL');
};

export const terminateAgentTree = async (pid: number | undefined): Promise<void> => {
  if (pid === undefined) return;

  try {
    if (process.platform === 'win32') await terminateWindowsTree(pid);
    else await terminatePosixTree(pid);
  } catch (error: unknown) {
    try {
      signalProcess(pid, 'SIGKILL');
    } catch (directError: unknown) {
      const causes = [error, directError];
      const cause = new AggregateError(causes, 'Tree and direct process termination failed');

      throw new AgentTerminationError(`Unable to terminate agent process tree ${pid}`, { cause });
    }

    throw new AgentTerminationError(`Unable to confirm termination of agent process tree ${pid}`, { cause: error });
  }
};
