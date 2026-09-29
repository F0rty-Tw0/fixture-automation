import { describe, expect, it } from 'vitest';

import { FixtureError } from './fixture.error.ts';

describe('FEATURE: fixture error', (): void => {
  describe('GIVEN a message and a fix', (): void => {
    it('WHEN constructed THEN carries the name, message and fix', (): void => {
      const error = new FixtureError('spec must be a URL', 'use file:///spec.json');

      expect(error).toMatchObject({ name: 'FixtureError', message: 'spec must be a URL', fix: 'use file:///spec.json' });
    });

    it('WHEN constructed THEN is an Error', (): void => {
      const error = new FixtureError('spec must be a URL', 'use file:///spec.json');

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('GIVEN a message alone', (): void => {
    it('WHEN constructed THEN leaves the fix undefined', (): void => {
      const error = new FixtureError('schema not found');

      expect(error.fix).toBeUndefined();
    });
  });
});
