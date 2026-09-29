import { TextDecoder } from 'node:util';

const MAXIMUM_OUTPUT_BYTES = 8 * 1024 * 1024;

type AgentOutput = {
  readonly stderr: string;
  readonly stdout: string;
};

type AgentOutputCollector = {
  readonly append: (chunk: Buffer, destination: 'stderr' | 'stdout') => string;
  readonly complete: () => AgentOutput;
};

const decodedText = (decoder: TextDecoder, chunk: Buffer | undefined): string => {
  try {
    if (chunk === undefined) return decoder.decode();

    return decoder.decode(chunk, { stream: true });
  } catch {
    throw new Error('Agent output is not valid UTF-8');
  }
};

/** Collects bounded UTF-8 output without losing split code points. */
export const agentOutputCollector = (): AgentOutputCollector => {
  const stderrDecoder = new TextDecoder('utf-8', { fatal: true });
  const stdoutDecoder = new TextDecoder('utf-8', { fatal: true });
  let outputBytes = 0;
  let stderr = '';
  let stdout = '';

  const append = (chunk: Buffer, destination: 'stderr' | 'stdout'): string => {
    outputBytes += chunk.byteLength;

    if (outputBytes > MAXIMUM_OUTPUT_BYTES) throw new Error('Agent output exceeds the 8 MiB limit');

    const decoder = destination === 'stdout' ? stdoutDecoder : stderrDecoder;
    const text = decodedText(decoder, chunk);

    if (destination === 'stdout') stdout += text;
    else stderr += text;

    return text;
  };
  const complete = (): AgentOutput => {
    stderr += decodedText(stderrDecoder, undefined);
    stdout += decodedText(stdoutDecoder, undefined);
    const output: AgentOutput = { stderr, stdout };

    return output;
  };
  const collector: AgentOutputCollector = { append, complete };

  return collector;
};
