import { agentOutputCollector } from './agent-process-output.client.ts';
import { AgentTerminationError } from './agent-process-termination.error.ts';
import { terminateAgentTree } from './agent-process-tree.client.ts';
import type { AiFixtureProgress } from '../common/ai-fixtures.type.ts';

type AgentOutputListener = () => void;
type AgentProgressListener = (progress: AiFixtureProgress) => void;

const progressListenerError = (cause: unknown): Error => {
  if (cause instanceof Error) return cause;

  return new Error('Agent progress listener failed', { cause });
};

const exitError = (executable: string, code: number | null, signal: NodeJS.Signals | null, stderr: string): Error => {
  const status = code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`;
  const detail = stderr.trim();
  const message =
    detail.length === 0
      ? `Agent "${executable}" exited with ${status}`
      : `Agent "${executable}" exited with ${status}: ${detail.slice(0, 2_000)}`;

  return new Error(message);
};

/** Owns captured output and termination for one spawned agent process. */
export class AgentProcessExecution {
  private readonly output = agentOutputCollector();
  private failure: Error | undefined;
  private termination: Promise<void> | undefined;
  private readonly onOutput: AgentOutputListener;
  private readonly onProgress: AgentProgressListener | undefined;
  private readonly pid: number | undefined;
  private readonly onTerminationFailure: (error: AgentTerminationError) => void;

  public constructor(
    pid: number | undefined,
    onTerminationFailure: (error: AgentTerminationError) => void,
    onOutput: AgentOutputListener,
    onProgress: AgentProgressListener | undefined
  ) {
    this.pid = pid;
    this.onTerminationFailure = onTerminationFailure;
    this.onOutput = onOutput;
    this.onProgress = onProgress;
  }

  private reportProgress(progress: AiFixtureProgress): Error | undefined {
    if (this.onProgress === undefined) return undefined;

    try {
      this.onProgress(progress);

      return undefined;
    } catch (cause: unknown) {
      const error = progressListenerError(cause);

      return error;
    }
  }

  private terminate(): void {
    if (this.termination !== undefined) return;

    const termination = terminateAgentTree(this.pid);

    this.termination = termination.catch((cause: unknown): void => {
      const reason = this.failure?.message ?? 'Agent shutdown';
      const failure = new AgentTerminationError(`${reason}; agent process tree termination failed`, { cause });

      this.failure = failure;

      this.onTerminationFailure(failure);
    });
  }

  public stop(error: Error): void {
    if (this.failure !== undefined) return;

    this.failure = error;
    this.terminate();
  }

  public reportStatus(text: string): Error | undefined {
    const progress: AiFixtureProgress = { stream: 'status', text };

    return this.reportProgress(progress);
  }

  public receiveOutput(chunk: Buffer, destination: 'stderr' | 'stdout'): void {
    if (this.failure !== undefined) return;

    try {
      const text = this.output.append(chunk, destination);

      if (this.onProgress === undefined) return;
      this.onOutput();

      if (text.length === 0) return;

      const progress: AiFixtureProgress = { stream: destination, text };

      const progressError = this.reportProgress(progress);

      if (progressError !== undefined) this.stop(progressError);
    } catch (error: unknown) {
      if (error instanceof Error) this.stop(error);
      else this.stop(new Error('Unable to read agent output', { cause: error }));
    }
  }

  public async result(executable: string, code: number | null, signal: NodeJS.Signals | null): Promise<string> {
    const termination = this.termination;

    if (termination !== undefined) await termination;

    const failure = this.failure;

    if (failure !== undefined) throw failure;

    const output = this.output.complete();

    if (code !== 0 && termination === undefined) {
      const exitFailure = exitError(executable, code, signal, output.stderr);

      this.failure = exitFailure;

      throw exitFailure;
    }

    return output.stdout;
  }
}
