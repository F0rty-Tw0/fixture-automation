import { fillJudge, wrongShapeOf } from './fill-judge.ts';
import { generateFixture } from './fixture-agent.ts';
import { AgentJsonError } from '../../agent-provider/common/agent-json.error.ts';
import type { AgentRequest } from '../../agent-provider/common/agent-provider.type.ts';
import type { PatternPromptInput } from '../../missing-patterns/common/missing-pattern.type.ts';
import { missingPatterns } from '../../missing-patterns/utils/path-pattern.util.ts';
import { MISSING_SCHEMA_NAME } from '../../missing-values/common/missing.const.ts';
import type {
  AiMissingFactory,
  AiMissingRequest,
  MissingFile,
  MissingFill,
  MissingValidator,
  MissingVerdict
} from '../../missing-values/common/missing.type.ts';
import { missingCheck } from '../../missing-values/utils/missing-check.util.ts';
import { missingDocument } from '../../missing-values/utils/missing-document.util.ts';
import { isListFill, isMissingFill } from '../../missing-values/utils/missing-fill.util.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { parseAiTool } from '../../shared/ai-tool/utils/ai-tool.util.ts';
import type { AgentFixture, FixtureCheck } from '../common/agent-fixture.type.ts';
import { AiFillRejectedError } from '../common/ai-fill-rejected.error.ts';
import { saveFailedResponse } from '../data-access/agent-response-file.client.ts';
import { patternPrompt } from '../utils/fixture-prompt.util.ts';

/** Compiles before the CLI runs, so a projection AJV cannot compile fails without spending a generation. */
const inProcessValidator = (missing: MissingFile): MissingValidator => {
  const check = missingCheck(missing);
  const validate = async (_missing: MissingFile, value: unknown): Promise<MissingVerdict> => Promise.resolve(check(value));

  return validate;
};

/** The innermost cause's message, which for a parse failure is the JSON parser's own diagnostic. */
function rootMessage(error: Error): string {
  const { cause } = error;

  if (cause instanceof Error) return rootMessage(cause);

  return error.message;
}

/** Why the run failed, as an `AiFillRejectedError` holding the parsed answers when there are any to salvage. */
const rejection = (error: unknown, candidates: unknown[]): unknown => {
  if (error instanceof AgentJsonError) return new AiFillRejectedError(error.message, candidates, rootMessage(error), { cause: error });

  const isSalvageable = error instanceof Error && candidates.length > 0;

  if (!isSalvageable) return error;

  return new AiFillRejectedError(error.message, candidates, error.message, { cause: error });
};

/**
 * The checked answer. Answers still not JSON after the repair, or a repair run that fails once an answer parsed,
 * reject with every candidate that parsed; a cancel or a run that fails before any answer rejects unchanged.
 */
const checkedFill = async (request: AgentRequest, check: FixtureCheck, candidates: unknown[]): Promise<AgentFixture> => {
  try {
    const generated = await generateFixture(request, check);

    return generated;
  } catch (error: unknown) {
    request.options.signal?.throwIfAborted();

    throw rejection(error, candidates);
  }
};

/**
 * Fill the fields a fixture diff reported as absent, returning only a projection-valid result; an answer still
 * unusable after the repair round rejects with an `AiFillRejectedError` holding every answer that parsed.
 * The diff's `missing.json` is self-contained, so the OpenAPI document is never loaded here.
 */
export const aiMissingFixture = (options: AiFixtureOptions): AiMissingFactory => {
  parseAiTool(options.tool);

  const enrich = async (name: string, request: AiMissingRequest): Promise<MissingFill> => {
    options.signal?.throwIfAborted();

    const { missing } = request;
    const scenario = request.scenario.trim();

    if (!scenario) throw new Error('a non-empty fixture scenario is required');

    const isSameSchema = missing.schemaName === name;

    if (!isSameSchema) throw new Error(`missing.json was diffed against schema "${missing.schemaName}", not "${name}"`);

    const fixtureJson: unknown = JSON.stringify(request.fixture);

    if (typeof fixtureJson !== 'string') throw new Error('the existing fixture must be JSON-serializable');

    const fixture: unknown = JSON.parse(fixtureJson);
    const document = missingDocument(missing);
    const patterns = missingPatterns(missing.paths);
    const validate = request.validate ?? inProcessValidator(missing);
    const { accepted, candidates, check } = fillJudge(missing, validate, patterns);
    const input: PatternPromptInput = { fixture, missing: document, patterns, scenario };
    const prompt = patternPrompt(input);
    const agentRequest: AgentRequest = { prompt, options };
    const generated = await checkedFill(agentRequest, check, candidates);
    const result = accepted();
    const isShaped = isMissingFill(result, isListFill(missing.paths));

    if (generated.problem === undefined && isShaped) return result;

    await saveFailedResponse(options, generated.response, generated.attempt);

    const problem = generated.problem ?? wrongShapeOf(missing);

    throw new AiFillRejectedError(`generated missing fields violate schema "${MISSING_SCHEMA_NAME}": ${problem}`, candidates, problem);
  };

  return enrich;
};
