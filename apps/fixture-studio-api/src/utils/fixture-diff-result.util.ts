import { diffFixture } from '@fixture-automation/openapi-fixture-diff';
import type { FixtureDiffRequest } from '@fixture-automation/openapi-fixture-diff';
import { orderLike } from '@fixture-automation/openapi-fixture-merge';
import { fixtures } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { trimmedPromptBytes } from './ai-prompt.util.ts';
import { assertEnvelope, fixtureJson, mergeFixtureValue, shapeKey } from './fixture-merge.util.ts';
import type { DiffBody, DiffResult, MissingFile } from '../contract/common/studio-api.type.ts';

const envelopeFor = (payload: unknown, objectShape: string | undefined): unknown => {
  if (objectShape === undefined) return payload;

  const envelope = { [objectShape]: payload };

  return envelope;
};

/**
 * What the fixture lacks against the endpoint's schema, plus the baseline completed from the sampler.
 * The completion follows the fixture's key order and appends new keys, so a replaced value keeps its place and the
 * completed text only inserts characters into the original pretty JSON, unless a value was replaced.
 */
export const fixtureDiffResult = (spec: OpenApiSpec, schemaName: string, body: DiffBody): DiffResult => {
  const { fixture, requiredOnly } = body;
  const objectShape = shapeKey(body.objectShape);
  const replacePlaceholders = body.replacePlaceholders ?? true;

  assertEnvelope(fixture, objectShape);

  const request: FixtureDiffRequest = { spec, schemaName, fixture, requiredOnly, objectShape, replacePlaceholders };
  const { schemaName: diffedName, dialect, paths, replaced, broken, schema, components, baseline } = diffFixture(request);
  const missing: MissingFile = { schemaName: diffedName, dialect, paths, schema, components };
  const sampleOptions = { skipNonRequired: requiredOnly };
  const sample = fixtures(spec, sampleOptions)(schemaName);
  const populated = envelopeFor(sample, objectShape);
  const completed = mergeFixtureValue(baseline, populated, objectShape);
  const ordered = orderLike(completed.value, fixture);
  const completeJson = fixtureJson(ordered);
  const promptBytes = trimmedPromptBytes(baseline, missing);
  const result: DiffResult = { missing, missingPaths: paths, replacedPaths: replaced, broken, baseline, completeJson, promptBytes };

  return result;
};
