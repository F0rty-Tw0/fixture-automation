import { fixtures, pruneSpec, typescriptStub } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { generateTypes } from '@fixture-automation/openapi-types';

import type { GenerateBody, GenerateResult, GeneratedFixture } from '../contract/common/studio-api.type.ts';
import { endpointSchemaName } from '../utils/endpoint-schema.util.ts';

type EndpointTarget = {
  readonly endpointId: string;
  readonly schemaName: string;
};

type SchemaSources = {
  readonly json: string | undefined;
  readonly stub: string | undefined;
  readonly types: string | undefined;
};

const targetOf = (spec: OpenApiSpec, endpointId: string): EndpointTarget => {
  const schemaName = endpointSchemaName(spec, endpointId);
  const target: EndpointTarget = { endpointId, schemaName };

  return target;
};

const typesSource = async (spec: OpenApiSpec, schemaName: string): Promise<string> => {
  const pruned = pruneSpec(spec, schemaName);
  const types = await generateTypes(pruned);

  return types;
};

const schemaSources = async (spec: OpenApiSpec, schemaName: string, request: GenerateBody): Promise<SchemaSources> => {
  const { formats, requiredOnly } = request;
  const sampleOptions = { skipNonRequired: requiredOnly };
  const fixture = fixtures(spec, sampleOptions)(schemaName);
  const json = JSON.stringify(fixture, null, 2);
  const wantsJson = formats.includes('json');
  const wantsStub = formats.includes('stub');
  const wantsTypes = formats.includes('types');
  let jsonFile: string | undefined;
  let stub: string | undefined;
  let types: string | undefined;

  if (wantsJson) jsonFile = `${json}\n`;

  if (wantsStub) stub = typescriptStub(schemaName, `./${schemaName}.d.ts`, json);

  if (wantsTypes) types = await typesSource(spec, schemaName);

  const sources: SchemaSources = { json: jsonFile, stub, types };

  return sources;
};

/**
 * Samples the requested formats for each endpoint's response schema the way the `openapi-fixtures` CLI does.
 * Endpoints sharing a schema reuse one sampling; `types` (the slow `openapi-typescript` run) happens only when asked for.
 */
export const generateFixtures = async (spec: OpenApiSpec, request: GenerateBody): Promise<GenerateResult> => {
  const targets = request.endpointIds.map((endpointId: string): EndpointTarget => targetOf(spec, endpointId));
  const sourcesBySchema = new Map<string, SchemaSources>();
  const generated: GeneratedFixture[] = [];

  for (const { endpointId, schemaName } of targets) {
    let sources = sourcesBySchema.get(schemaName);

    if (sources === undefined) {
      sources = await schemaSources(spec, schemaName, request);
      sourcesBySchema.set(schemaName, sources);
    }

    const fixture: GeneratedFixture = { endpointId, schemaName, ...sources };

    generated.push(fixture);
  }

  const result: GenerateResult = { fixtures: generated };

  return result;
};
