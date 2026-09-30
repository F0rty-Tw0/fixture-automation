import { AgentJsonError } from '../../agent-provider/common/agent-json.error.ts';
import type { AgentRequest } from '../../agent-provider/common/agent-provider.type.ts';
import { antigravityFixture } from '../../agent-provider/domain-logic/antigravity-generation.ts';
import { claudeFixture } from '../../agent-provider/domain-logic/claude-generation.ts';
import { codexFixture } from '../../agent-provider/domain-logic/codex-generation.ts';
import { copilotFixture } from '../../agent-provider/domain-logic/copilot-generation.ts';
import { geminiFixture } from '../../agent-provider/domain-logic/gemini-generation.ts';
import { readAgentJson } from '../../agent-provider/utils/agent-response.util.ts';
import { MISSING_PROMPT_LIMIT_BYTES } from '../../missing-values/common/missing.const.ts';
import type { AgentFixture, FixtureCheck } from '../common/agent-fixture.type.ts';
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
  const parsed = readAgentJson(response, request.options.tool);
  const fixture: AgentFixture = { ...parsed, response, attempt };

  return fixture;
};

const parserDiagnostic = (error: AgentJsonError): string => {
  const { cause } = error;

  if (cause instanceof Error) return cause.message;

  return String(cause);
};

type FailedAttempt = {
  readonly response: string;
  readonly error: string;
  /** The parsed first answer when `check`, not the JSON parser, rejected it. */
  readonly fixture?: AgentFixture;
};

/** The first answer when it parses and passes `check`, otherwise why it failed. */
const firstAttempt = async (request: AgentRequest, check: FixtureCheck | undefined): Promise<AgentFixture | FailedAttempt> => {
  const response = await generateOnce(request);

  try {
    const fixture = parsedFixture(response, request, 1);
    const problem = await check?.(fixture.value, fixture);

    if (problem === undefined) return fixture;

    const failed: FailedAttempt = { response, error: problem, fixture };

    return failed;
  } catch (error: unknown) {
    if (!(error instanceof AgentJsonError)) throw error;

    const failed: FailedAttempt = { response: error.response, error: parserDiagnostic(error) };

    return failed;
  }
};

/**
 * One answer, repaired once when it is not JSON or `check` rejects it. A repaired answer that still fails `check`
 * comes back with its `problem`; one that is still not JSON throws.
 */
export const generateFixture = async (request: AgentRequest, check?: FixtureCheck): Promise<AgentFixture> => {
  const first = await firstAttempt(request, check);

  if ('value' in first) return first;

  const prompt = repairAgentPrompt(request.prompt, first.response, first.error);
  const promptBytes = Buffer.byteLength(prompt, 'utf8');
  const isOversized = promptBytes > MISSING_PROMPT_LIMIT_BYTES;

  // A checked answer too big to repair keeps its validation details rather than failing on the input limit.
  if (isOversized && first.fixture !== undefined) {
    const unrepaired: AgentFixture = { ...first.fixture, problem: first.error };

    return unrepaired;
  }

  await saveFailedResponse(request.options, first.response, 1);

  request.options.signal?.throwIfAborted();

  const correction: AgentRequest = { prompt, options: request.options };
  const correctedResponse = await generateOnce(correction);
  let fixture: AgentFixture;

  try {
    fixture = parsedFixture(correctedResponse, request, 2);
  } catch (cause: unknown) {
    if (!(cause instanceof AgentJsonError)) throw cause;

    await saveFailedResponse(request.options, cause.response, 2);

    throw new AgentJsonError(`${request.options.tool} returned invalid JSON after 2 attempts`, cause.response, { cause });
  }

  const problem = await check?.(fixture.value, fixture);
  const checked: AgentFixture = { ...fixture, problem };

  return checked;
};
