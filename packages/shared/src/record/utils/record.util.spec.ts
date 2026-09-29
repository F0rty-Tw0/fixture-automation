import { describe, expect, it } from 'vitest';

import { isRecord } from './record.util.ts';

describe('FEATURE: record detection', (): void => {
  describe('GIVEN an empty object', (): void => {
    it('WHEN checked THEN accepts it', (): void => {
      expect(isRecord({})).toBe(true);
    });
  });

  describe('GIVEN an object with keys', (): void => {
    it('WHEN checked THEN accepts it', (): void => {
      expect(isRecord({ a: 1 })).toBe(true);
    });
  });

  describe.each([null, undefined, 42, 'x', [], [1]])('GIVEN the non-record value %s', (value): void => {
    it('WHEN checked THEN rejects it', (): void => {
      expect(isRecord(value)).toBe(false);
    });
  });
});
