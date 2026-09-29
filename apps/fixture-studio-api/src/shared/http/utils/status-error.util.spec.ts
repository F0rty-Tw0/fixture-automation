import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { statusError } from './status-error.util.ts';

describe('FEATURE: status error', (): void => {
  describe('GIVEN a status, message and fix', (): void => {
    it('WHEN built THEN is a FixtureError carrying all three', (): void => {
      const error = statusError(404, 'spec not found', 'load it again');

      expect(error).toBeInstanceOf(FixtureError);
      expect(error).toMatchObject({ statusCode: 404, message: 'spec not found', fix: 'load it again' });
    });
  });
});
