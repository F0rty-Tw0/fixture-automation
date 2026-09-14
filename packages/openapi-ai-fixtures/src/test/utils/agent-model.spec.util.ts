import type { AgentCommand, AgentRequest } from '../../common/agent.type.ts';
import type { AiFixtureOptions, AiTool } from '../../common/ai-fixtures.type.ts';

const MODEL_PROMPT = 'Return a fixture.';

/** Argument vector of the single `runAgent` call, given its mock's recorded calls, for adapter passthrough assertions. */
export const agentArgs = (calls: (readonly [AgentCommand, AiFixtureOptions])[]): string[] => {
  const [call] = calls;

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
