import { diffFixture, missingProjection } from '@fixture-automation/openapi-fixture-diff';
import type { FixtureDiff, FixtureDiffRequest } from '@fixture-automation/openapi-fixture-diff';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { fixtureCompletion } from './fixture-completion.util.ts';
import { payloadShape } from './fixture-envelope.util.ts';
import { fixtureJson, shapeKey } from './fixture-merge.util.ts';
import { trimmedPromptBytes } from '../../ai/utils/ai-prompt.util.ts';
import type { DiffBody, DiffResult, MissingFile } from '../../contract/common/studio-api.type.ts';
import type { CompletionInput } from '../common/fixture.type.ts';

/** A diff with nothing to fill: the payload could not be placed, so the fixture is answered as it is. */
const unplacedResult = (diff: FixtureDiff, fixture: unknown, warnings: string[]): DiffResult => {
  const schema = missingProjection([]);
  const components = { schemas: {} };
  const missing: MissingFile = { schemaName: diff.schemaName, dialect: diff.dialect, paths: [], schema, components };
  const completeJson = fixtureJson(fixture);
  const result: DiffResult = {
    missing,
    missingPaths: [],
    replacedPaths: [],
    broken: [],
    baseline: fixture,
    completeJson,
    promptBytes: 0,
    warnings
  };

  return result;
};

/**
 * What the fixture lacks against the endpoint's schema, plus the baseline completed from the sampler.
 * The completion follows the fixture's key order and appends new keys, so a replaced value keeps its place and the
 * completed text only inserts characters into the original pretty JSON, unless a value was replaced.
 * An envelope the fixture lacks falls back as `payloadShape` decides; `warnings` says so in plain language. When the
 * payload cannot be placed at all, nothing is listed to fill and the fixture comes back as it is.
 */
export const fixtureDiffResult = (spec: OpenApiSpec, schemaName: string, body: DiffBody): DiffResult => {
  const { fixture, requiredOnly } = body;
  const requestedShape = shapeKey(body.objectShape);
  const { objectShape, unplaced, warnings: shapeWarnings } = payloadShape(spec, schemaName, fixture, requestedShape);
  const replacePlaceholders = body.replacePlaceholders ?? true;
  const request: FixtureDiffRequest = { spec, schemaName, fixture, requiredOnly, objectShape, replacePlaceholders };
  const diff = diffFixture(request);

  if (unplaced !== undefined) return unplacedResult(diff, fixture, shapeWarnings);

  const { schemaName: diffedName, dialect, paths, replaced, broken, schema, components, baseline } = diff;
  const missing: MissingFile = { schemaName: diffedName, dialect, paths, schema, components };
  const keepPresent = !replacePlaceholders;
  const input: CompletionInput = { spec, schemaName, fixture, baseline, objectShape, requiredOnly, keepPresent };
  const completion = fixtureCompletion(input);
  const promptBytes = trimmedPromptBytes(baseline, missing);
  const warnings = [...shapeWarnings, ...completion.warnings];
  const result: DiffResult = {
    missing,
    missingPaths: paths,
    replacedPaths: replaced,
    broken,
    baseline,
    completeJson: completion.json,
    promptBytes,
    warnings
  };

  return result;
};
