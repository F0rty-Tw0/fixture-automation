import { agentOutputCollector } from './agent-process-output.client.ts';
import { AgentTerminationError } from './agent-process-termination.error.ts';
import { terminateAgentTree } from './agent-process-tree.client.ts';

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
  private readonly pid: number | undefined;
  private readonly onTerminationFailure: (error: AgentTerminationError) => void;

  public constructor(pid: number | undefined, onTerminationFailure: (error: AgentTerminationError) => void) {
    this.pid = pid;
    this.onTerminationFailure = onTerminationFailure;
  }

  public stop(error: Error): void {
    if (this.failure !== undefined) return;

    this.failure = error;
    const termination = terminateAgentTree(this.pid);

    this.termination = termination.catch((cause: unknown): void => {
      const failure = new AgentTerminationError(`${error.message}; agent process tree termination failed`, { cause });

      this.failure = failure;

      this.onTerminationFailure(failure);
    });
  }

  public receiveOutput(chunk: Buffer, destination: 'stderr' | 'stdout'): void {
    if (this.failure !== undefined) return;

    try {
      this.output.append(chunk, destination);
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

    if (code !== 0) throw exitError(executable, code, signal, output.stderr);

    return output.stdout;
  }
}
