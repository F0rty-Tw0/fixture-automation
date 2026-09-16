import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

import type { AgentExecution, AgentProcess, AgentRespond } from '../common/agent.type.ts';
import { contentLengthMessage } from '../utils/agent-message-framing.util.ts';

const conversationReceiver = (
  child: ChildProcessWithoutNullStreams,
  process: AgentProcess,
  respond: AgentRespond,
  execution: AgentExecution
): ((message: string) => void) => {
  let complete = false;
  let inputBytes = Buffer.byteLength(process.input);
  const receive = (message: string): void => {
    if (complete) return;

    try {
      const response = respond(message, process.scratchDirectory);

      if (response === undefined) return;

      if (response === null) {
        complete = true;

        if (process.stopOnComplete === true) execution.complete();
        else child.stdin.end();

        return;
      }

      inputBytes += Buffer.byteLength(response);

      if (inputBytes > 1024 * 1024) throw new Error('Agent input exceeds the 1 MiB limit');

      child.stdin.write(response);
    } catch (cause: unknown) {
      complete = true;

      if (cause instanceof Error) execution.stop(cause);
      else execution.stop(new Error('Agent conversation failed', { cause }));
    }
  };

  return receive;
};

const pipeContentLengthMessages = (
  child: ChildProcessWithoutNullStreams,
  receive: (message: string) => void,
  execution: AgentExecution
): void => {
  let pending: Buffer = Buffer.alloc(0);
  const append = (chunk: Buffer): void => {
    try {
      if (pending.length === 0) pending = chunk;
      else pending = Buffer.concat([pending, chunk]);

      if (pending.length > 8 * 1024 * 1024) throw new Error('Agent output exceeds the 8 MiB limit');

      let frame = contentLengthMessage(pending);

      while (frame !== undefined) {
        pending = frame.rest;
        receive(frame.message);
        frame = contentLengthMessage(pending);
      }
    } catch (cause: unknown) {
      if (cause instanceof Error) execution.stop(cause);
      else execution.stop(new Error('Invalid provider framing', { cause }));
    }
  };

  child.stdout.on('data', append);
};

export const pipeAgentProcess = (child: ChildProcessWithoutNullStreams, process: AgentProcess, execution: AgentExecution): void => {
  child.stdout.on('data', (chunk: Buffer): void => execution.receiveOutput(chunk, 'stdout'));
  child.stderr.on('data', (chunk: Buffer): void => execution.receiveOutput(chunk, 'stderr'));
  child.stdin.once('error', (error: Error): void => {
    execution.stop(new Error(`Agent stdin failed: ${error.message}`));
  });

  const { input, respond } = process;

  if (respond === undefined) {
    child.stdin.end(input);

    return;
  }

  const receive = conversationReceiver(child, process, respond, execution);

  if (process.messageFormat === 'content-length') pipeContentLengthMessages(child, receive, execution);
  else {
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });

    lines.on('line', receive);
    child.once('close', (): void => lines.close());
  }

  child.stdin.write(input);
};
