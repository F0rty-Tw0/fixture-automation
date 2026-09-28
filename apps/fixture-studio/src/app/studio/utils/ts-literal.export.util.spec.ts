import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { fixtureExpression } from './ts-literal.export.util.ts';

const expressionText = (text: string): string | undefined => {
  const source = ts.createSourceFile('fixture.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  return fixtureExpression(source)?.getText(source);
};

describe('FEATURE: fixture expression lookup', (): void => {
  it.each([
    ['an export default', "export const A = 1;\nexport default { id: 'x' };", "{ id: 'x' }"],
    ['an export default of a same-file const, over an earlier exported const', "export const SCHEMA = 'Invoice';\nconst invoice = { id: 'x' };\nexport default invoice;", "{ id: 'x' }"],
    ['an export default of an unknown identifier', 'export default invoice;', 'invoice'],
    ['an exported const after a local one', 'const a = 1;\nexport const B = 2;', '2'],
    ['only a local const', 'const a = [1];', '[1]']
  ])('GIVEN %s WHEN looked up THEN picks the fixture value', (_label, text, expected): void => {
    expect(expressionText(text)).toBe(expected);
  });

  it('GIVEN no value at all WHEN looked up THEN finds nothing', (): void => {
    expect(expressionText('export type A = { id: string };')).toBeUndefined();
  });
});
