import { describe, expect, it } from 'vitest';

import { isSchemaRecord } from './schema-record.util.ts';

describe('FEATURE: schema record predicate', (): void => {
  describe('GIVEN a plain object', (): void => {
    it('WHEN checking THEN accepts it', (): void => {
      expect(isSchemaRecord({ type: 'string' })).toBe(true);
    });

    it('WHEN the object is empty THEN still accepts it', (): void => {
      expect(isSchemaRecord({})).toBe(true);
    });
  });

  describe('GIVEN a non-object value', (): void => {
    it.each([
      ['null', null],
      ['an array', []],
      ['a string', 'object'],
      ['a boolean', true],
      ['undefined', undefined]
    ])('WHEN checking %s THEN rejects it', (_case: string, value: unknown): void => {
      expect(isSchemaRecord(value)).toBe(false);
    });
  });
});
