import type { Change } from '@codemirror/merge';
import { describe, expect, it } from 'vitest';

import { lineDiff } from './line-diff.util.ts';

type Edit = { readonly removed: string; readonly added: string };

const editsOf = (a: string, b: string): Edit[] => {
  const changes = lineDiff(a, b);

  return changes.map((change: Change): Edit => {
    const edit: Edit = { removed: a.slice(change.fromA, change.toA), added: b.slice(change.fromB, change.toB) };

    return edit;
  });
};

/** A pretty-printed object far longer than CodeMirror's default diff scan limit. */
const bigObject = (extra: Record<string, unknown>): string => {
  const entries = Array.from({ length: 400 }, (_: unknown, index: number): [string, string] => [`key_${index}`, 'string']);
  const record = Object.fromEntries(entries);
  const object = { first: 1, ...record, ...extra };

  return JSON.stringify(object, null, 2);
};

type Account = {
  readonly id: string;
  readonly currency: string;
  readonly balance: number;
  readonly buying_power: number;
};

const accountOf = (index: number, buyingPower: number): Account => {
  const account: Account = { id: `acc_${index}`, currency: 'DKK', balance: 1.02, buying_power: buyingPower };

  return account;
};

/** Twenty thousand accounts: far too many scattered edits for one line diff to finish within its timeout. */
const accountsJson = (buyingPower: number): string => {
  const accounts = Array.from({ length: 20_000 }, (_: unknown, index: number): Account => accountOf(index, buyingPower));

  return JSON.stringify({ accounts }, null, 2);
};

describe('FEATURE: line diff', (): void => {
  it('GIVEN equal texts WHEN diffed THEN returns no changes', (): void => {
    expect(lineDiff('{\n  "a": 1\n}', '{\n  "a": 1\n}')).toStrictEqual([]);
  });

  it('GIVEN a line added far from another change WHEN diffed THEN marks only the two edits', (): void => {
    const a = bigObject({});
    const b = bigObject({ last: true }).replace('"first": 1', '"first": 2');

    expect(editsOf(a, b)).toStrictEqual([
      { removed: '1', added: '2' },
      { removed: '', added: ',\n  "last": true' }
    ]);
  });

  it('GIVEN a changed line WHEN diffed THEN narrows the change to the characters that differ', (): void => {
    const a = '{\n  "a": 0\n}';
    const b = '{\n  "a": 0,\n  "b": true\n}';

    expect(editsOf(a, b)).toStrictEqual([{ removed: '', added: ',\n  "b": true' }]);
  });

  it('GIVEN a line removed WHEN diffed THEN marks the removed line', (): void => {
    expect(editsOf('a\nb\nc', 'a\nc')).toStrictEqual([{ removed: 'b\n', added: '' }]);
  });

  it('GIVEN thousands of scattered edits WHEN diffed THEN each stays on its own line instead of one block', (): void => {
    const a = accountsJson(0);
    const b = accountsJson(50_000);

    const edits = editsOf(a, b);
    const isOneLine = (edit: Edit): boolean => {
      const text = `${edit.removed}${edit.added}`;

      return !text.includes('\n');
    };

    expect(edits).toHaveLength(20_000);
    expect(edits.every(isOneLine)).toBe(true);
  });
});
