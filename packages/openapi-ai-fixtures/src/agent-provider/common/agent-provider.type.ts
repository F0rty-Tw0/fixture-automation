import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

export type AgentRequest = {
  readonly prompt: string;
  readonly options: AiFixtureOptions;
};

/** A model's parsed JSON answer; `isRecovered` when it had to be dug out of prose or Markdown around it. */
export type AgentJson = {
  readonly value: unknown;
  readonly isRecovered: boolean;
  /** Other JSON values recovered from the same text, best first; empty for plain JSON. */
  readonly alternatives: unknown[];
};
