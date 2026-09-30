import type { FillOptions } from '@fixture-automation/openapi-fixture-merge';
import { describe, expect, it } from 'vitest';

import { fixtureJson, mergeFixtureValue, presentShape, shapeKey } from './fixture-merge.util.ts';

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
      it.each<[string, string | undefined, string | undefined]>([
        ['absent', undefined, undefined],
        ['present', 'data', 'data']
      ])(
        'WHEN the object-shape is %s THEN the present shape is %s',
        (_label: string, objectShape: string | undefined, expected: string | undefined): void => {
          const fixture = { data: {} };

          expect(presentShape(fixture, objectShape)).toBe(expected);
        }
      );
    });

    describe('GIVEN a fixture without the envelope key', (): void => {
      it.each<[string, unknown]>([
        ['an object lacking it', { other: {} }],
        ['not an object', 'not an object']
      ])(
        'WHEN it is %s THEN there is no present shape, so the whole fixture is the payload',
        (_label: string, fixture: unknown): void => {
          expect(presentShape(fixture, 'data')).toBeUndefined();
        }
      );
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

      it('WHEN the populated value lacks it THEN the populated value fills the payload inside the envelope', (): void => {
        const fixtureData = { id: 'a' };
        const fixture = { data: fixtureData };
        const populated = { status: 'open' };

        const merged = mergeFixtureValue(fixture, populated, 'data');

        const data = { id: 'a', status: 'open' };
        const value = { data };

        expect(merged).toStrictEqual({ value, filled: ['data.status'] });
      });

      it('WHEN merged with keepPresent THEN a payload value of another type is kept', (): void => {
        const fixtureData = { amount_due: '5' };
        const fixture = { data: fixtureData };
        const populatedData = { amount_due: 5 };
        const populated = { data: populatedData };
        const options: FillOptions = { keepPresent: true };

        const merged = mergeFixtureValue(fixture, populated, 'data', options);

        expect(merged).toStrictEqual({ value: fixture, filled: [] });
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
