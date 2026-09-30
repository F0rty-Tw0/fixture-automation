import { describe, expect, it } from 'vitest';

import { parseFixtureSource } from './fixture-source.reader.ts';
import type { LiteralParse } from '../common/comparison.type.ts';

const read = (value: unknown): LiteralParse => {
  const parse: LiteralParse = { kind: 'value', value };

  return parse;
};

describe('FEATURE: fixture source reader', (): void => {
  describe('SCENARIO: files', (): void => {
    it('GIVEN a .json file WHEN read THEN parses JSON', async (): Promise<void> => {
      await expect(parseFixtureSource('{"id":1}', 'a.json', false)).resolves.toStrictEqual(read({ id: 1 }));
    });

    it('GIVEN a broken .json file WHEN read THEN rejects without trying TypeScript', async (): Promise<void> => {
      const parse = await parseFixtureSource('export const A = {};', 'a.json', false);

      expect(parse).toStrictEqual({ kind: 'error', message: 'a.json is not valid JSON.' });
    });

    it('GIVEN a .json file with comments and trailing commas WHEN read THEN reads it as an object literal', async (): Promise<void> => {
      const text = '{\n  // the invoice\n  "id": "in_1",\n  "lines": [1, 2,],\n}\n';

      await expect(parseFixtureSource(text, 'a.json', false)).resolves.toStrictEqual(read({ id: 'in_1', lines: [1, 2] }));
    });

    it('GIVEN a .json file that no reader accepts WHEN read THEN keeps the JSON error', async (): Promise<void> => {
      const parse = await parseFixtureSource('{ "id": ', 'a.json', false);

      expect(parse).toStrictEqual({ kind: 'error', message: 'a.json is not valid JSON.' });
    });

    it('GIVEN a .ts file WHEN read THEN reads its literal', async (): Promise<void> => {
      await expect(parseFixtureSource("export const A = { id: 'x' } as const;", 'a.ts', false)).resolves.toStrictEqual(read({ id: 'x' }));
    });
  });

  describe('SCENARIO: pasted text', (): void => {
    it('GIVEN pasted JSON WHEN read THEN parses JSON', async (): Promise<void> => {
      await expect(parseFixtureSource('[1, 2]', 'Pasted text', true)).resolves.toStrictEqual(read([1, 2]));
    });

    it('GIVEN a pasted bare object literal WHEN read THEN reads it as TypeScript', async (): Promise<void> => {
      await expect(parseFixtureSource("{ id: 'x', n: -1 }", 'Pasted text', true)).resolves.toStrictEqual(read({ id: 'x', n: -1 }));
    });

    it('GIVEN pasted TypeScript source WHEN read THEN reads its export', async (): Promise<void> => {
      await expect(parseFixtureSource('export const A = [true];', 'Pasted text', true)).resolves.toStrictEqual(read([true]));
    });
  });
});
