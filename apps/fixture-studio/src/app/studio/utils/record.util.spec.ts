import { describe, expect, it } from 'vitest';

import { isRecord } from './record.util.ts';

describe('FEATURE: record detection', (): void => {
  it('GIVEN a plain object WHEN checked THEN accepts it', (): void => {
    expect(isRecord({ openapi: '3.1.0' })).toBe(true);
  });

  describe.each([null, undefined, 42, 'spec', [], [1]])('GIVEN the non-record value %s', (value): void => {
    it('WHEN checked THEN rejects it', (): void => {
      expect(isRecord(value)).toBe(false);
    });
  });
});
