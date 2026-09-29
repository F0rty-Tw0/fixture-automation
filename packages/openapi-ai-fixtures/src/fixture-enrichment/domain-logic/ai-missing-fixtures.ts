import { generateFixture } from './fixture-agent.ts';
import type { AgentRequest } from '../../agent-provider/common/agent-provider.type.ts';
import { MISSING_SCHEMA_NAME } from '../../missing-values/common/missing.const.ts';
import type {
  AiMissingFactory,
  AiMissingRequest,
  MissingFile,
  MissingPromptInput,
  MissingValidator,
  MissingVerdict
} from '../../missing-values/common/missing.type.ts';
import { missingCheck } from '../../missing-values/utils/missing-check.util.ts';
import { missingDocument } from '../../missing-values/utils/missing-document.util.ts';
import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { parseAiTool } from '../../shared/ai-tool/utils/ai-tool.util.ts';
import { saveFailedResponse } from '../data-access/agent-response-file.client.ts';
import { missingPrompt } from '../utils/fixture-prompt.util.ts';

/** Compiles before the CLI runs, so a projection AJV cannot compile fails without spending a generation. */
const inProcessValidator = (missing: MissingFile): MissingValidator => {
  const check = missingCheck(missing);
  const validate = async (_missing: MissingFile, value: unknown): Promise<MissingVerdict> => Promise.resolve(check(value));

  return validate;
};

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
    const validate = request.validate ?? inProcessValidator(missing);
    const input: MissingPromptInput = { fixtureJson, missing: document, scenario };
    const prompt = missingPrompt(input);
    const agentRequest: AgentRequest = { prompt, options };
    const generated = await generateFixture(agentRequest);
    const result = generated.value;
    const verdict = await validate(missing, result);
    const isValidFill = verdict.valid && isSchemaRecord(result);

    if (isValidFill) return result;

    await saveFailedResponse(options, generated.response, generated.attempt);

    throw new Error(`generated missing fields violate schema "${MISSING_SCHEMA_NAME}": ${verdict.details}`);
  };

  return enrich;
};
