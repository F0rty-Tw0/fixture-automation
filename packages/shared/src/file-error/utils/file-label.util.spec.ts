import { describe, expect, it } from 'vitest';

import { fileLabel } from './file-label.util.ts';

describe('FEATURE: file label', (): void => {
  describe('GIVEN a label and a file name', (): void => {
    it('WHEN rendered THEN quotes the file after the label', (): void => {
      expect(fileLabel('spec', 'api.json')).toBe('spec file "api.json"');
    });
  });
});
