import { describe, expect, it } from 'vitest';

import { pathPointer, sampleAtPath } from './fill-path.util.ts';

const SAMPLE_LINE = { sku: 'string', quantity: 0 };
const SAMPLE = { lines: [SAMPLE_LINE] };
const LIST_SAMPLE = [SAMPLE_LINE];

describe('FEATURE: fill paths', (): void => {
  describe('GIVEN a diff path', (): void => {
    it('WHEN turned into a pointer THEN keys and indices become escaped pointer tokens', (): void => {
      const pointer = pathPointer('a/b.lines[2].c~d');

      expect(pointer).toBe('/a~1b/lines/2/c~0d');
    });
  });

  describe('GIVEN a sampler value with one element per array', (): void => {
    it('WHEN a path at a later index is read THEN reads the first element instead', (): void => {
      const value = sampleAtPath(SAMPLE, 'lines[3].quantity');

      expect(value).toBe(0);
    });

    it('WHEN a list sample is read at a later index THEN reads its first element', (): void => {
      const value = sampleAtPath(LIST_SAMPLE, '[4].sku');

      expect(value).toBe('string');
    });
  });
});
