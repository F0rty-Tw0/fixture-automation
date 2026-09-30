import { describe, expect, it } from 'vitest';

import { pathPointer } from './path-pointer.util.ts';

describe('FEATURE: path pointers', (): void => {
  describe('GIVEN a diff path', (): void => {
    it('WHEN turned into a pointer THEN keys and indices become escaped pointer tokens', (): void => {
      const pointer = pathPointer('a/b.lines[2].c~d');

      expect(pointer).toBe('/a~1b/lines/2/c~0d');
    });
  });
});
