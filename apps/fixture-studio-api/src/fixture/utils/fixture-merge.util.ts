import { fillObjectShape } from '@fixture-automation/openapi-fixture-merge';
import type { FillOptions, FillResult } from '@fixture-automation/openapi-fixture-merge';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

/** A blank `objectShape` means none, as in the merge CLI. */
export const shapeKey = (objectShape: string | undefined): string | undefined => {
  const trimmed = objectShape?.trim();

  return trimmed === '' ? undefined : trimmed;
};

/** `objectShape` when the fixture holds it as an own property; otherwise `undefined`, so the whole fixture is the payload. */
export const presentShape = (fixture: unknown, objectShape: string | undefined): string | undefined => {
  if (objectShape === undefined) return undefined;

  if (!isRecord(fixture)) return undefined;

  const hasShape = Object.hasOwn(fixture, objectShape);

  return hasShape ? objectShape : undefined;
};

/** `populated` as an envelope holding `objectShape`; a fill answering with the bare payload is wrapped in it. */
const populatedEnvelope = (populated: unknown, objectShape: string): unknown => {
  const envelope = { [objectShape]: populated };

  if (!isRecord(populated)) return envelope;

  const hasShape = Object.hasOwn(populated, objectShape);

  return hasShape ? populated : envelope;
};

/**
 * The merge CLI's `fillObjectShape`. `objectShape` must be one `fixture` holds (see `presentShape`); a `populated`
 * value without it is taken as the payload itself, so the merge never fails over a missing envelope.
 */
export const mergeFixtureValue = (
  fixture: unknown,
  populated: unknown,
  objectShape: string | undefined,
  options?: FillOptions
): FillResult => {
  if (objectShape === undefined) return fillObjectShape(fixture, populated, undefined, options);

  const envelope = populatedEnvelope(populated, objectShape);

  return fillObjectShape(fixture, envelope, objectShape, options);
};

/** Two-space JSON with a final newline, as the CLIs write fixtures. */
export const fixtureJson = (value: unknown): string => {
  const json: unknown = JSON.stringify(value, null, 2);

  if (typeof json !== 'string') throw new FixtureError('the fixture is not JSON-serializable');

  return `${json}\n`;
};
