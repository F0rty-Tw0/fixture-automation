import { saveFailedResponse } from './agent-response-file.client.ts';
import { generateFixture } from './fixture-agent.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';
import { MISSING_SCHEMA_NAME } from '../common/missing.const.ts';
import type { AiMissingFactory, AiMissingRequest, MissingPromptInput } from '../common/missing.type.ts';
import { parseAiTool } from '../utils/ai-tool.util.ts';
import { missingPrompt } from '../utils/fixture-prompt.util.ts';
import { missingDocument } from '../utils/missing-document.util.ts';
import { compileFixtureSchema } from '../utils/schema-validator.util.ts';
import { validationDetails } from '../utils/validation-message.util.ts';

/**
 * Fill the fields a fixture diff reported as absent, returning only a projection-valid result.
 * The diff's `missing.json` is self-contained, so the OpenAPI document is never loaded here.
 */
export const aiMissingFixture = (options: AiFixtureOptions): AiMissingFactory => {
  parseAiTool(options.tool);

  const enrich = async (name: string, request: AiMissingRequest): Promise<Record<string, unknown>> => {
    options.signal?.throwIfAborted();

    const { missing } = request;
    const scenario = request.scenario.trim();

    if (!scenario) throw new Error('a non-empty fixture scenario is required');

    const isSameSchema = missing.schemaName === name;

    if (!isSameSchema) throw new Error(`missing.json was diffed against schema "${missing.schemaName}", not "${name}"`);

    const fixtureJson: unknown = JSON.stringify(request.fixture);

    if (typeof fixtureJson !== 'string') throw new Error('the existing fixture must be JSON-serializable');

    const document = missingDocument(missing);
    const validate = compileFixtureSchema<Record<string, unknown>>(document, missing.dialect);
    const input: MissingPromptInput = { fixtureJson, missing: document, scenario };
    const prompt = missingPrompt(input);
    const agentRequest: AgentRequest = { prompt, options };
    const generated = await generateFixture(agentRequest);
    const result = generated.value;

    if (validate(result)) return result;

    const details = validationDetails(validate.errors);

    await saveFailedResponse(options, generated.response, generated.attempt);

    throw new Error(`generated missing fields violate schema "${MISSING_SCHEMA_NAME}": ${details}`);
  };

  return enrich;
};
