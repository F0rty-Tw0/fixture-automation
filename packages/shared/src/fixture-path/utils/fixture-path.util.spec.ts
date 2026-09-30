import { describe, expect, it } from 'vitest';

import { parsePath } from './fixture-path.util.ts';
import type { PathToken } from '../common/path.type.ts';

describe('FEATURE: parse a fixture path', (): void => {
  describe('GIVEN a valid path', (): void => {
    it('WHEN it mixes keys and an index THEN splits into keys and numbers', (): void => {
      const tokens = parsePath('lines.data[0].id');

      const expected: PathToken[] = ['lines', 'data', 0, 'id'];

      expect(tokens).toStrictEqual(expected);
    });

    it('WHEN it starts at an index THEN the first token is that index', (): void => {
      const tokens = parsePath('[1].status');

      const expected: PathToken[] = [1, 'status'];

      expect(tokens).toStrictEqual(expected);
    });

    it('WHEN one key holds consecutive indices THEN each index is its own token', (): void => {
      const tokens = parsePath('a[0][1]');

      const expected: PathToken[] = ['a', 0, 1];

      expect(tokens).toStrictEqual(expected);
    });
  });

  describe('GIVEN an invalid path', (): void => {
    it.each(['lines[a]', 'a.[0]', 'a..b', ''])('WHEN %j is parsed THEN throws', (path: string): void => {
      const parse = (): PathToken[] => parsePath(path);

      expect(parse).toThrow(`invalid fixture path "${path}"`);
    });
  });
});
