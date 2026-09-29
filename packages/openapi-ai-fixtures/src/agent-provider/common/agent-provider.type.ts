import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

export type AgentRequest = {
  readonly prompt: string;
  readonly options: AiFixtureOptions;
};
