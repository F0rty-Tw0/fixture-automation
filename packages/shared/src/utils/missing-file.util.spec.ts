import { describe, expect, it } from 'vitest';

import { isMissingFile } from './missing-file.util.ts';

describe('FEATURE: missing file detection', (): void => {
  describe('GIVEN an Error with code ENOENT', (): void => {
    it('WHEN checked THEN reports the file as missing', (): void => {
      const error = Object.assign(new Error('missing'), { code: 'ENOENT' });

      expect(isMissingFile(error)).toBe(true);
    });
  });

  describe('GIVEN an Error with code EACCES', (): void => {
    it('WHEN checked THEN does not report the file as missing', (): void => {
      const error = Object.assign(new Error('denied'), { code: 'EACCES' });

      expect(isMissingFile(error)).toBe(false);
    });
  });

  describe('GIVEN an Error without a code', (): void => {
    it('WHEN checked THEN does not report the file as missing', (): void => {
      expect(isMissingFile(new Error('plain'))).toBe(false);
    });
  });

  describe('GIVEN a non-Error object with code ENOENT', (): void => {
    it('WHEN checked THEN does not report the file as missing', (): void => {
      expect(isMissingFile({ code: 'ENOENT' })).toBe(false);
    });
  });
});
