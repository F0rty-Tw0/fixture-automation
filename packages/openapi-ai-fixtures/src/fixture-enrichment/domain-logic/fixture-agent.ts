import { AgentJsonError } from '../../agent-provider/common/agent-json.error.ts';
import type { AgentRequest } from '../../agent-provider/common/agent-provider.type.ts';
import { antigravityFixture } from '../../agent-provider/domain-logic/antigravity-generation.ts';
import { claudeFixture } from '../../agent-provider/domain-logic/claude-generation.ts';
import { codexFixture } from '../../agent-provider/domain-logic/codex-generation.ts';
import { copilotFixture } from '../../agent-provider/domain-logic/copilot-generation.ts';
import { geminiFixture } from '../../agent-provider/domain-logic/gemini-generation.ts';
import { parseAgentJson } from '../../agent-provider/utils/agent-response.util.ts';
import type { AgentFixture } from '../common/agent-fixture.type.ts';
import { saveFailedResponse } from '../data-access/agent-response-file.client.ts';
import { repairAgentPrompt } from '../utils/agent-repair-prompt.util.ts';

const generateOnce = async (request: AgentRequest): Promise<string> => {
  switch (request.options.tool) {
    case 'claude':
      return claudeFixture(request);
    case 'codex':
      return codexFixture(request);
    case 'antigravity':
      return antigravityFixture(request);
    case 'copilot':
      return copilotFixture(request);
    case 'gemini':
      return geminiFixture(request);
  }
};

const parsedFixture = (response: string, request: AgentRequest, attempt: 1 | 2): AgentFixture => {
  const value = parseAgentJson(response, request.options.tool);
  const fixture: AgentFixture = { value, response, attempt };

  return fixture;
};

const parserDiagnostic = (error: AgentJsonError): string => {
  const { cause } = error;

  if (cause instanceof Error) return cause.message;

  return String(cause);
};

export const generateFixture = async (request: AgentRequest): Promise<AgentFixture> => {
  const response = await generateOnce(request);

  try {
    return parsedFixture(response, request, 1);
  } catch (error: unknown) {
    if (!(error instanceof AgentJsonError)) throw error;

    await saveFailedResponse(request.options, error.response, 1);

    request.options.signal?.throwIfAborted();

    const parseError = parserDiagnostic(error);
    const prompt = repairAgentPrompt(request.prompt, error.response, parseError);
    const correction: AgentRequest = { prompt, options: request.options };
    const correctedResponse = await generateOnce(correction);

    try {
      return parsedFixture(correctedResponse, request, 2);
    } catch (cause: unknown) {
      if (!(cause instanceof AgentJsonError)) throw cause;

      await saveFailedResponse(request.options, cause.response, 2);

      throw new AgentJsonError(`${request.options.tool} returned invalid JSON after 2 attempts`, cause.response, { cause });
    }
  }
};
