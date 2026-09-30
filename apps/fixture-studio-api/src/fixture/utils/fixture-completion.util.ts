import { orderLike } from '@fixture-automation/openapi-fixture-merge';
import type { FillOptions } from '@fixture-automation/openapi-fixture-merge';
import { schemaSample } from '@fixture-automation/openapi-fixtures';
import { isRecord, selectFixtureShape } from '@fixture-automation/shared';

import { fixtureJson, mergeFixtureValue } from './fixture-merge.util.ts';
import type { Completion, CompletionInput } from '../common/fixture.type.ts';

/** The JSON kind of `value` in plain language, as a warning names it. */
const kindName = (value: unknown): string => {
  if (value === null) return 'null';

  if (Array.isArray(value)) return 'a list';

  if (isRecord(value)) return 'an object';

  return `a ${typeof value}`;
};

/** The sampler's value for the payload; a list payload gets one sampled item per element, so every element is filled. */
const payloadSample = (input: CompletionInput, payload: unknown): unknown => {
  const options = { skipNonRequired: input.requiredOnly };
  const sampled = schemaSample(input.spec, input.schemaName, options);

  if (!Array.isArray(payload)) return sampled;

  const item: unknown = Array.isArray(sampled) ? sampled[0] : sampled;

  if (item === undefined) return sampled;

  return payload.map((): unknown => item);
};

const envelopeFor = (payload: unknown, objectShape: string | undefined): unknown => {
  if (objectShape === undefined) return payload;

  const envelope = { [objectShape]: payload };

  return envelope;
};

const mismatchWarning = (payloadKind: string, sampleKind: string): string => {
  return `The fixture is ${payloadKind} but the endpoint's schema describes ${sampleKind}, so nothing was filled in.`;
};

const samplerWarning = (error: Error): string => {
  return `The example generator could not read this schema (${error.message}), so nothing was filled in.`;
};

const unchangedCompletion = (baseline: unknown, warning: string): Completion => {
  const json = fixtureJson(baseline);
  const unchanged: Completion = { json, warnings: [warning] };

  return unchanged;
};

/**
 * The baseline completed from the sampler, in the fixture's key order. A payload whose JSON kind differs from the
 * sample (an object where the schema describes a list) is never overwritten: the baseline is answered as it is, with
 * a warning, as it is when the sampler cannot read the schema (an `$anchor` it does not resolve). With `keepPresent`, a
 * present value of the wrong type is kept rather than replaced by the sample.
 */
export const fixtureCompletion = (input: CompletionInput): Completion => {
  const payload = selectFixtureShape(input.baseline, input.objectShape);
  let sample: unknown;

  try {
    sample = payloadSample(input, payload);
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;

    return unchangedCompletion(input.baseline, samplerWarning(error));
  }

  const payloadKind = kindName(payload);
  const sampleKind = kindName(sample);

  if (payloadKind !== sampleKind) return unchangedCompletion(input.baseline, mismatchWarning(payloadKind, sampleKind));

  const populated = envelopeFor(sample, input.objectShape);
  const options: FillOptions = { keepPresent: input.keepPresent };
  const completed = mergeFixtureValue(input.baseline, populated, input.objectShape, options);
  const ordered = orderLike(completed.value, input.fixture);
  const json = fixtureJson(ordered);
  const completion: Completion = { json, warnings: [] };

  return completion;
};
