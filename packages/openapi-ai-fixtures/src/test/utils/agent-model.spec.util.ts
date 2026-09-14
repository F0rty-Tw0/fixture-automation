import { vi } from 'vitest';

import type { AgentRequest } from '../../common/agent.type.ts';
import type { AiFixtureOptions, AiTool } from '../../common/ai-fixtures.type.ts';
import { runAgent } from '../../data-access/agent-process.client.ts';

const MODEL_PROMPT = 'Return a fixture.';

/** Argument vector of the single mocked `runAgent` call, for adapter passthrough assertions. */
export const agentArgs = (): string[] => {
  const [call] = vi.mocked(runAgent).mock.calls;

  if (call === undefined) throw new Error('runAgent was not called');

  const [command] = call;

  return command.args;
};

/** An agent request for one harness, with `model` omitted entirely when no slug is given. */
export const modelRequest = (tool: AiTool, model?: string): AgentRequest => {
  const base: AiFixtureOptions = { tool };

  if (model === undefined) {
    const withoutModel: AgentRequest = { prompt: MODEL_PROMPT, options: base };

    return withoutModel;
  }

  const options: AiFixtureOptions = { ...base, model };
  const request: AgentRequest = { prompt: MODEL_PROMPT, options };

  return request;
};
