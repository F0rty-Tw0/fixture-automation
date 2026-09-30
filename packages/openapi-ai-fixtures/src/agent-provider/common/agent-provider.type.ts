import type { AgentFile } from '../../agent-process/common/agent-process.type.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

export type AgentRequest = {
  readonly prompt: string;
  readonly options: AiFixtureOptions;
  /** Files staged in the scratch directory for the agent to read; non-empty switches the adapter to its read-only tools. */
  readonly files?: AgentFile[];
};

/** A model's parsed JSON answer; `isRecovered` when it had to be dug out of prose or Markdown around it. */
export type AgentJson = {
  readonly value: unknown;
  readonly isRecovered: boolean;
  /** Other JSON values recovered from the same text, best first; empty for plain JSON. */
  readonly alternatives: unknown[];
};
