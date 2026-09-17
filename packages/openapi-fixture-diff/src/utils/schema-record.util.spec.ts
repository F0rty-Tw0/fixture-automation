import { describe, expect, it } from 'vitest';

import { isSchema } from './schema-record.util.ts';

describe('FEATURE: schema position guard', (): void => {
  describe('GIVEN an object schema', (): void => {
    it('WHEN guarding THEN it is a schema', (): void => {
      const value: unknown = { type: 'string' };

      const result = isSchema(value);

      expect(result).toBe(true);
    });
  });

  describe('GIVEN an empty object', (): void => {
    it('WHEN guarding THEN it is a schema', (): void => {
      const value: unknown = {};

      const result = isSchema(value);

      expect(result).toBe(true);
    });
  });

  describe('GIVEN a boolean schema', (): void => {
    it('WHEN guarding THEN it is not a schema', (): void => {
      const value: unknown = true;

      const result = isSchema(value);

      expect(result).toBe(false);
    });
  });

  describe('GIVEN a tuple of item schemas', (): void => {
    it('WHEN guarding THEN it is not a schema', (): void => {
      const value: unknown = [{ type: 'string' }];

      const result = isSchema(value);

      expect(result).toBe(false);
    });
  });

  describe('GIVEN null', (): void => {
    it('WHEN guarding THEN it is not a schema', (): void => {
      const value: unknown = null;

      const result = isSchema(value);

      expect(result).toBe(false);
    });
  });
});
