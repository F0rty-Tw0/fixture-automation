import { fillObjectShape } from '@fixture-automation/openapi-fixture-merge';
import type { FillResult } from '@fixture-automation/openapi-fixture-merge';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { selectFixtureShape } from '@fixture-automation/shared';

const SHAPE_FIX = 'clear object-shape, or name the envelope property that holds the payload';

/** A blank `objectShape` means none, as in the merge CLI. */
export const shapeKey = (objectShape: string | undefined): string | undefined => {
  const trimmed = objectShape?.trim();

  return trimmed === '' ? undefined : trimmed;
};

/** Fails with a 400 `FixtureError` when `objectShape` names no own property of `fixture`. */
export const assertEnvelope = (fixture: unknown, objectShape: string | undefined): void => {
  if (objectShape === undefined) return;

  try {
    selectFixtureShape(fixture, objectShape);
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;

    throw new FixtureError(error.message, SHAPE_FIX);
  }
};

/** The merge CLI's `fillObjectShape`, with its missing-envelope error turned into a 400 `FixtureError`; other errors pass through. */
export const mergeFixtureValue = (fixture: unknown, populated: unknown, objectShape: string | undefined): FillResult => {
  if (objectShape === undefined) return fillObjectShape(fixture, populated, undefined);

  try {
    return fillObjectShape(fixture, populated, objectShape);
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;

    throw new FixtureError(error.message, SHAPE_FIX);
  }
};

/** Two-space JSON with a final newline, as the CLIs write fixtures. */
export const fixtureJson = (value: unknown): string => {
  const json: unknown = JSON.stringify(value, null, 2);

  if (typeof json !== 'string') throw new FixtureError('the fixture is not JSON-serializable');

  return `${json}\n`;
};
