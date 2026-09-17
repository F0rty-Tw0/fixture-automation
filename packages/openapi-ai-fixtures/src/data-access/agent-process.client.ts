import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveAgentExecutable } from './agent-executable.client.ts';
import { runAgentProcess } from './agent-process-lifecycle.client.ts';
import { AgentTerminationError } from './agent-process-termination.error.ts';
import { agentEnvironment, stageAgentFiles } from './agent-process-workspace.client.ts';
import type { AgentCommand } from '../common/agent.type.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';

const MAXIMUM_INPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 900_000;
const MAXIMUM_TIMEOUT_MS = 2_147_483_647;

const cancellationError = (reason: unknown): Error => {
  if (reason instanceof Error) return reason;

  return new Error('Agent execution was canceled');
};

const validateInput = (input: string): void => {
  const inputBytes = Buffer.byteLength(input, 'utf8');

  if (inputBytes > MAXIMUM_INPUT_BYTES) throw new Error('Agent input exceeds the 1 MiB limit');
};

const timeoutFor = (options: AiFixtureOptions): number => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const isInteger = Number.isSafeInteger(timeoutMs);
  const isSupportedTimerDuration = isInteger && timeoutMs > 0 && timeoutMs <= MAXIMUM_TIMEOUT_MS;

  if (!isSupportedTimerDuration) {
    const message = 'Agent timeout must be a positive integer no greater than 2147483647 milliseconds';

    throw new Error(message);
  }

  return timeoutMs;
};

const runInScratchDirectory = async (command: AgentCommand, options: AiFixtureOptions, timeoutMs: number): Promise<string> => {
  const scratchDirectory = await mkdtemp(join(tmpdir(), 'openapi-ai-fixtures-'));
  let retainWorkspace = false;

  try {
    await stageAgentFiles(scratchDirectory, command);

    const environment = agentEnvironment(command);
    const resolvedExecutable = await resolveAgentExecutable(command.executable, options.executable);
    const executable = resolvedExecutable[0];
    const executableArguments = resolvedExecutable.slice(1);
    const args = [...executableArguments, ...command.args];
    const agentProcess = {
      args,
      environment,
      executable,
      input: command.input,
      respond: command.respond,
      scratchDirectory,
      timeoutMs
    };
    const output = await runAgentProcess(agentProcess, options);

    return output;
  } catch (error: unknown) {
    if (error instanceof AgentTerminationError) {
      retainWorkspace = true;

      throw new AgentTerminationError(`${error.message}; temporary directory retained at ${scratchDirectory}`, { cause: error });
    }

    throw error;
  } finally {
    if (!retainWorkspace) await rm(scratchDirectory, { force: true, recursive: true });
  }
};

/** Runs an installed coding tool in an isolated scratch directory without a shell. */
export const runAgent = async (command: AgentCommand, options: AiFixtureOptions): Promise<string> => {
  validateInput(command.input);

  const timeoutMs = timeoutFor(options);
  const signal = options.signal;
  const isCanceled = signal?.aborted ?? false;

  if (isCanceled) throw cancellationError(signal?.reason);

  const output = await runInScratchDirectory(command, options, timeoutMs);

  return output;
};
