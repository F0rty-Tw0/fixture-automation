import { orderLike } from '@fixture-automation/openapi-fixture-merge';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { selectFixtureShape } from '@fixture-automation/shared';

import { fixtureJson, mergeFixtureValue, shapeKey } from './fixture-merge.util.ts';
import { validationErrors } from './fixture-validation.util.ts';
import type { MergeBody, MergeResult } from '../contract/common/studio-api.type.ts';

/**
 * `populated` merged into `fixture` and validated against the endpoint's schema; a violation is data, not an error.
 * `mergedJson` follows the key order of `original` when given, so a refilled baseline key stays where it was.
 */
export const fixtureMergeResult = (spec: OpenApiSpec, schemaName: string, body: MergeBody): MergeResult => {
  const objectShape = shapeKey(body.objectShape);
  const merged = mergeFixtureValue(body.fixture, body.populated, objectShape);
  const payload = selectFixtureShape(merged.value, objectShape);
  const errors = validationErrors(spec, schemaName, payload);
  const ordered = orderLike(merged.value, body.original);
  const mergedJson = fixtureJson(ordered);
  const result: MergeResult = { mergedJson, filled: merged.filled, valid: errors.length === 0, errors };

  return result;
};
