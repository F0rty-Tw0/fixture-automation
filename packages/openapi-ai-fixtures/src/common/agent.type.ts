import type { AiFixtureOptions } from './ai-fixtures.type.ts';

export type AgentRequest = {
  readonly prompt: string;
  readonly options: AiFixtureOptions;
};

export type AgentFixture = {
  readonly value: unknown;
  readonly response: string;
  readonly attempt: 1 | 2;
};

export type AgentFile = {
  readonly path: string;
  readonly content: string;
};

/** Return wire input, undefined to keep waiting, or null to complete the conversation. */
export type AgentRespond = (message: string, scratchDirectory: string) => string | null | undefined;

export type AgentCommand = {
  readonly executable: string;
  readonly args: string[];
  readonly input: string;
  readonly files?: AgentFile[];
  readonly env?: Record<string, string | undefined>;
  readonly respond?: AgentRespond;
};

export type AgentProcess = {
  readonly args: string[];
  readonly environment: NodeJS.ProcessEnv;
  readonly executable: string;
  readonly input: string;
  readonly respond: AgentRespond | undefined;
  readonly scratchDirectory: string;
  readonly timeoutMs: number;
};

export type AgentExecution = {
  readonly receiveOutput: (chunk: Buffer, destination: 'stderr' | 'stdout') => void;
  readonly stop: (error: Error) => void;
};
