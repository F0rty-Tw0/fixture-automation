import { describe, expect, it } from 'vitest';

import { finiteJson, recoveredJson } from './json-recovery.util.ts';

describe('FEATURE: JSON recovered from model prose', (): void => {
  describe('GIVEN JSON text', (): void => {
    it('WHEN parsed strictly THEN returns its value', (): void => {
      const value = finiteJson('{"n":1}');

      expect(value).toStrictEqual({ n: 1 });
    });

    it('WHEN a number overflows THEN throws rather than returning Infinity', (): void => {
      expect((): unknown => finiteJson('{"n":1e400}')).toThrow('JSON number exceeds the finite JavaScript range');
    });
  });

  describe('GIVEN prose holding several JSON values', (): void => {
    it('WHEN recovered THEN ranks objects over lists over scalars, then larger over smaller', (): void => {
      const text = 'Per [1] and [2, 3]: ```\n42\n``` then {"a":1} or {"a":1,"b":2}.';

      const values = recoveredJson(text);

      expect(values).toStrictEqual([{ a: 1, b: 2 }, { a: 1 }, [2, 3], [1], 42]);
    });

    it('WHEN two values are the same size THEN the earlier one comes first', (): void => {
      const values = recoveredJson('{"id":"first"} then {"id":"second"}');

      expect(values).toStrictEqual([{ id: 'first' }, { id: 'second' }]);
    });

    it('WHEN a fence and a span hold the same value THEN it is listed once', (): void => {
      const values = recoveredJson('```json\n{"id":"x"}\n```');

      expect(values).toStrictEqual([{ id: 'x' }]);
    });

    it('WHEN brackets sit inside a JSON string THEN the span still closes where the JSON does', (): void => {
      const values = recoveredJson('The fill is {"memo":"a } and [ inside","n":1}. Done.');

      expect(values).toStrictEqual([{ memo: 'a } and [ inside', n: 1 }]);
    });
  });

  describe('GIVEN prose with a flood of distinct JSON spans', (): void => {
    it('WHEN recovered THEN keeps only the best nine values', (): void => {
      const spans = Array.from({ length: 5000 }, (_value: unknown, index: number): string => `[${index}]`);
      const text = `${spans.join(' ')} and the answer {"id":"x"}`;

      const values = recoveredJson(text);

      expect(values).toHaveLength(9);
      expect(values[0]).toStrictEqual({ id: 'x' });
    });
  });

  describe('GIVEN prose with nothing usable', (): void => {
    it.each(['I cannot help {} [] sorry.', 'Draft {not json} and [unclosed', 'no brackets at all'])(
      'WHEN %j is recovered THEN nothing is found',
      (text: string): void => {
        const values = recoveredJson(text);

        expect(values).toStrictEqual([]);
      }
    );
  });
});
