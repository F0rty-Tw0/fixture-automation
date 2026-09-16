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

export type AgentCommand = {
  readonly executable: string;
  readonly args: string[];
  readonly input: string;
  readonly files?: AgentFile[];
  readonly env?: Record<string, string | undefined>;
};
