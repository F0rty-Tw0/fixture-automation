import { describe, expect, it } from 'vitest';

import { assertEnvelope, fixtureJson, mergeFixtureValue, shapeKey } from './fixture-merge.util.ts';

const SHAPE_FIX = 'clear object-shape, or name the envelope property that holds the payload';

describe('FEATURE: fixture merge', (): void => {
  describe('SCENARIO: object-shape key', (): void => {
    describe('GIVEN an object-shape value', (): void => {
      it.each<[string, string | undefined, string | undefined]>([
        ['absent', undefined, undefined],
        ['blank', '   ', undefined],
        ['padded', ' data ', 'data']
      ])('WHEN it is %s THEN the key is %s', (_label: string, objectShape: string | undefined, expected: string | undefined): void => {
        const key = shapeKey(objectShape);

        expect(key).toBe(expected);
      });
    });
  });

  describe('SCENARIO: envelope check', (): void => {
    describe('GIVEN a fixture holding the envelope key', (): void => {
      it.each<[string, string | undefined]>([
        ['absent', undefined],
        ['present', 'data']
      ])('WHEN the object-shape is %s THEN it passes', (_label: string, objectShape: string | undefined): void => {
        const fixture = { data: {} };

        expect((): void => assertEnvelope(fixture, objectShape)).not.toThrow();
      });
    });

    describe('GIVEN a fixture without the envelope key', (): void => {
      it('WHEN checked THEN fails with the object-shape fix', (): void => {
        const fixture = { other: {} };

        expect((): void => assertEnvelope(fixture, 'data')).toThrow(
          expect.objectContaining({ message: 'fixture has no own property "data" for object-shape', fix: SHAPE_FIX })
        );
      });
    });
  });

  describe('SCENARIO: merge value', (): void => {
    describe('GIVEN no object-shape', (): void => {
      it('WHEN merged THEN fills the missing keys after the existing ones', (): void => {
        const fixture = { id: 'a' };
        const populated = { status: 'open' };

        const merged = mergeFixtureValue(fixture, populated, undefined);

        const value = { id: 'a', status: 'open' };

        expect(merged).toStrictEqual({ value, filled: ['status'] });
        expect(Object.keys(fixture)).toStrictEqual(['id']);
      });

      it('WHEN the merge itself throws THEN the error passes through without an object-shape fix', (): void => {
        const fixture = Object.defineProperty({}, 'id', {
          enumerable: true,
          get: (): never => {
            throw new Error('getter failed');
          }
        });
        const populated = { status: 'open' };

        expect((): unknown => mergeFixtureValue(fixture, populated, undefined)).toThrow(
          expect.objectContaining({ name: 'Error', message: 'getter failed' })
        );
      });
    });

    describe('GIVEN an object-shape envelope', (): void => {
      it('WHEN merged THEN fills inside the envelope and prefixes the filled paths', (): void => {
        const fixtureData = { id: 'a' };
        const fixture = { data: fixtureData, meta: 1 };
        const populatedData = { status: 'open' };
        const populated = { data: populatedData };

        const merged = mergeFixtureValue(fixture, populated, 'data');

        const data = { id: 'a', status: 'open' };
        const value = { data, meta: 1 };

        expect(merged).toStrictEqual({ value, filled: ['data.status'] });
      });

      it.each<[string, unknown, unknown]>([
        ['the fixture lacks it', { other: {} }, { data: {} }],
        ['the fixture is not an object', 'not an object', { data: {} }],
        ['the populated value lacks it', { data: {} }, {}]
      ])('WHEN %s THEN fails with a FixtureError carrying the fix', (_label: string, fixture: unknown, populated: unknown): void => {
        expect((): unknown => mergeFixtureValue(fixture, populated, 'data')).toThrow(
          expect.objectContaining({
            name: 'FixtureError',
            message: 'fixture has no own property "data" for object-shape',
            fix: SHAPE_FIX
          })
        );
      });
    });
  });

  describe('SCENARIO: fixture JSON', (): void => {
    describe('GIVEN a JSON value', (): void => {
      it('WHEN printed THEN is two-space JSON with a final newline', (): void => {
        const json = fixtureJson({ a: 1 });

        expect(json).toBe('{\n  "a": 1\n}\n');
      });
    });

    describe('GIVEN a value JSON cannot print', (): void => {
      it('WHEN printed THEN fails', (): void => {
        expect((): string => fixtureJson(undefined)).toThrow('the fixture is not JSON-serializable');
      });
    });
  });
});
