import { orderLike } from '@fixture-automation/openapi-fixture-merge';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { selectFixtureShape } from '@fixture-automation/shared';

import { payloadShape } from './fixture-envelope.util.ts';
import { fixtureJson, mergeFixtureValue, shapeKey } from './fixture-merge.util.ts';
import { validationErrors } from './fixture-validation.util.ts';
import type { MergeBody, MergeResult } from '../../contract/common/studio-api.type.ts';

/** Nothing merged: the fixture lacks the `unplaced` envelope and nothing in it looks like the payload. */
const unmerged = (fixture: unknown, unplaced: string): MergeResult => {
  const mergedJson = fixtureJson(fixture);
  const error = `The fixture has no "${unplaced}" property and nothing in it looks like the payload, so nothing was merged.`;
  const result: MergeResult = { mergedJson, filled: [], valid: false, errors: [error] };

  return result;
};

/**
 * `populated` merged into `fixture` and validated against the endpoint's schema; a violation is data, not an error.
 * `mergedJson` follows the key order of `original` when given, so a refilled baseline key stays where it was.
 * Never fails over an envelope: one the fixture lacks falls back as `payloadShape` decides (as the diff does); when the
 * payload cannot be placed, the fixture comes back unmerged and not valid, with a plain-language error. A `populated`
 * payload without the envelope is filled into the fixture's envelope.
 */
export const fixtureMergeResult = (spec: OpenApiSpec, schemaName: string, body: MergeBody): MergeResult => {
  const requestedShape = shapeKey(body.objectShape);
  const { objectShape, unplaced } = payloadShape(spec, schemaName, body.fixture, requestedShape);

  if (unplaced !== undefined) return unmerged(body.fixture, unplaced);

  const merged = mergeFixtureValue(body.fixture, body.populated, objectShape);
  const payload = selectFixtureShape(merged.value, objectShape);
  const errors = validationErrors(spec, schemaName, payload);
  const ordered = orderLike(merged.value, body.original);
  const mergedJson = fixtureJson(ordered);
  const result: MergeResult = { mergedJson, filled: merged.filled, valid: errors.length === 0, errors };

  return result;
};
