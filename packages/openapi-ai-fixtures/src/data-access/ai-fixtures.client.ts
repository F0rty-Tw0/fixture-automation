import type { OpenApiSpec, SchemaMap } from '@fixture-automation/openapi-fixtures';

import { saveFailedResponse } from './agent-response-file.client.ts';
import { generateFixture } from './fixture-agent.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';
import type { AiFixtureFactory, AiFixtureOptions, AiFixtureRequest } from '../common/ai-fixtures.type.ts';
import { parseAiTool } from '../utils/ai-tool.util.ts';
import { fixturePrompt } from '../utils/fixture-prompt.util.ts';
import { prepareSchema } from '../utils/schema-context.util.ts';
import { validationDetails } from '../utils/validation-message.util.ts';

/** Enrich existing fixtures with an installed coding tool, returning only schema-valid results. */
export const aiFixtures = <TComponents extends SchemaMap = SchemaMap>(
  spec: OpenApiSpec,
  options: AiFixtureOptions
): AiFixtureFactory<TComponents> => {
  parseAiTool(options.tool);

  const enrich = async <TSchemaName extends keyof TComponents['schemas'] & string>(
    name: TSchemaName,
    request: AiFixtureRequest<TComponents['schemas'][TSchemaName]>
  ): Promise<TComponents['schemas'][TSchemaName]> => {
    options.signal?.throwIfAborted();

    const scenario = request.scenario.trim();

    if (!scenario) throw new Error('a non-empty fixture scenario is required');

    const fixtureJson: unknown = JSON.stringify(request.fixture);

    if (typeof fixtureJson !== 'string') throw new Error('the existing fixture must be JSON-serializable');

    const prepared = prepareSchema<TComponents['schemas'][TSchemaName]>(spec, name);
    const prompt = fixturePrompt(prepared.context, fixtureJson, scenario);
    const agentRequest: AgentRequest = { prompt, options };
    const generated = await generateFixture(agentRequest);
    const result = generated.value;

    if (prepared.validate(result)) return result;

    const details = validationDetails(prepared.validate.errors);

    await saveFailedResponse(options, generated.response, generated.attempt);

    throw new Error(`generated fixture violates schema "${name}": ${details}`);
  };

  return enrich;
};
