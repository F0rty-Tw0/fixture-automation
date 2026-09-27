import { describe, expect, it } from 'vitest';

import { readTsLiteral } from './ts-literal.util.ts';
import type { LiteralParse } from '../common/comparison.type.ts';

const valueOf = (source: string): unknown => {
  const parse = readTsLiteral(source, 'fixture.ts');

  return parse.kind === 'value' ? parse.value : parse.message;
};

describe('FEATURE: TypeScript literal reader', (): void => {
  describe('SCENARIO: accepted literals', (): void => {
    it('GIVEN an exported const object WHEN read THEN returns its value', (): void => {
      const source = "export const INVOICE = { id: 'in_1', 'amount-due': 1200, paid: false, memo: null };";

      expect(valueOf(source)).toStrictEqual({ id: 'in_1', 'amount-due': 1200, paid: false, memo: null });
    });

    it('GIVEN arrays, negative numbers and plain templates WHEN read THEN returns them', (): void => {
      const source = 'export const LINES = [{ delta: -5, label: `plain` }, 2.5, true];';

      expect(valueOf(source)).toStrictEqual([{ delta: -5, label: 'plain' }, 2.5, true]);
    });

    it.each([
      ['as const', "export const A = { id: 'x' } as const;"],
      ['satisfies', "export const A = { id: 'x' } satisfies Invoice;"],
      ['a type annotation and parens', "export const A: Invoice = ({ id: 'x' });"],
      ['an as cast', "export const A = { id: 'x' } as unknown as Invoice;"]
    ])('GIVEN a value wrapped in %s WHEN read THEN unwraps it', (_label, source): void => {
      expect(valueOf(source)).toStrictEqual({ id: 'x' });
    });

    it('GIVEN an export default WHEN read THEN prefers it', (): void => {
      const source = "const helper = { a: 1 };\nexport default { id: 'x' };";

      expect(valueOf(source)).toStrictEqual({ id: 'x' });
    });

    it('GIVEN an export default of a same-file const WHEN read THEN reads that const', (): void => {
      const source = "export const SCHEMA = 'Invoice';\nconst invoice = { id: 'x' } as const;\nexport default invoice;";

      expect(valueOf(source)).toStrictEqual({ id: 'x' });
    });

    it('GIVEN an export default of an identifier declared elsewhere WHEN read THEN names it', (): void => {
      const source = "import { invoice } from './invoice.ts';\nexport default invoice;";

      expect(valueOf(source)).toContain('the identifier "invoice"');
    });

    it('GIVEN a non-exported const before an exported one WHEN read THEN takes the exported one', (): void => {
      const source = "const local = { a: 1 };\nexport const FIXTURE = { b: 2 };";

      expect(valueOf(source)).toStrictEqual({ b: 2 });
    });

    it('GIVEN a __proto__ key WHEN read THEN keeps it as own data, like JSON.parse, without touching the prototype', (): void => {
      const parse = readTsLiteral("export const A = { __proto__: { polluted: true }, id: 'x' };", 'fixture.ts');
      const value = parse.kind === 'value' ? parse.value : undefined;
      const expected: unknown = JSON.parse('{"__proto__":{"polluted":true},"id":"x"}');

      expect(value).toStrictEqual(expected);
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
      expect(Object.keys(value ?? {})).toStrictEqual(['__proto__', 'id']);
    });

    it('GIVEN a duplicate key WHEN read THEN the last one wins, like JSON.parse', (): void => {
      expect(valueOf('export const A = { id: 1, id: 2 };')).toStrictEqual({ id: 2 });
    });

    it('GIVEN only a plain const WHEN read THEN takes it', (): void => {
      expect(valueOf('const fixture = [1, 2];')).toStrictEqual([1, 2]);
    });
  });

  describe('SCENARIO: rejected expressions', (): void => {
    it.each([
      ['an identifier', 'export const A = { customer: CUSTOMER };', 'Line 1: the identifier "CUSTOMER"'],
      ['a call', 'export const A = { at: new Date() };', 'Line 1: a NewExpression'],
      ['a function call', 'export const A = { id: makeId() };', 'Line 1: a function call'],
      ['an object spread', 'export const A = { ...BASE, id: 1 };', 'Line 1: a spread'],
      ['an array spread', 'export const A = [...ITEMS];', 'Line 1: a spread'],
      ['a template with substitutions', 'export const A = { id: `in_${n}` };', 'Line 1: a template with ${…}'],
      ['a shorthand property', 'export const A = { id };', 'Line 1: the shorthand property "id"'],
      ['a computed key', 'export const A = { [KEY]: 1 };', 'Line 1: a computed property name']
    ])('GIVEN %s WHEN read THEN names it and the line', (_label, source, expected): void => {
      const parse = readTsLiteral(source, 'fixture.ts');

      expect(parse.kind).toBe('error');
      expect(valueOf(source)).toContain(expected);
    });

    it('GIVEN a rejection on a later line WHEN read THEN reports that line', (): void => {
      const source = 'export const A = {\n  id: 1,\n  customer: CUSTOMER\n};';

      expect(valueOf(source)).toContain('Line 3:');
    });

    it('GIVEN no const and no default export WHEN read THEN explains what it looks for', (): void => {
      const expected: LiteralParse = { kind: 'error', message: 'fixture.ts has no `export const` or `export default` with a value.' };

      expect(readTsLiteral('export type A = { id: string };', 'fixture.ts')).toStrictEqual(expected);
    });
  });
});
