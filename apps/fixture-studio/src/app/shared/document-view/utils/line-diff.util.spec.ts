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

/** Rebuilds `b` from `a` by swapping in each change's `b` text; a correct diff gives back `b` exactly. */
const applyChanges = (a: string, b: string, changes: Change[]): string => {
  let result = '';
  let position = 0;

  for (const change of changes) {
    result += a.slice(position, change.fromA) + b.slice(change.fromB, change.toB);
    position = change.toA;
  }

  return result + a.slice(position);
};

/** A seeded linear congruential generator, so a failing case is the same on every run. */
const randomFrom = (seed: number): (() => number) => {
  let state = seed;

  return (): number => {
    state = (state * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;

    return state / 0x7f_ff_ff_ff;
  };
};

type TextPair = {
  readonly a: string;
  readonly b: string;
};

/** Short texts over a few repeated lines, with lines dropped, swapped, added, and a trailing newline either way. */
const randomPair = (random: () => number): TextPair => {
  const pick = (count: number): number => Math.floor(random() * count);
  const alphabet = 1 + pick(12);
  const linesA = Array.from({ length: 1 + pick(40) }, (): string => `l${pick(alphabet)}`);

  /** One line in ten is dropped, one replaced, one followed by a new line; the rest stay. */
  const editLine = (line: string): string[] => {
    const edits = [[], [`l${pick(alphabet * 2)}`], [line, `n${pick(alphabet)}`]];

    return edits[pick(10)] ?? [line];
  };

  const linesB = linesA.flatMap(editLine);
  const endA = random() < 0.5 ? '\n' : '';
  const endB = random() < 0.5 ? '\n' : '';
  const pair: TextPair = { a: `${linesA.join('\n')}${endA}`, b: `${linesB.join('\n')}${endB}` };

  return pair;
};

/** `count` gaps of random repeated lines, each opened by a line unique to both texts: every gap is slow to diff. */
const hardGaps = (count: number): TextPair => {
  const random = randomFrom(7);
  const gapLine = (): string => `x${Math.floor(random() * 50)}`;
  const linesA: string[] = [];
  const linesB: string[] = [];

  for (let gap = 0; gap < count; gap++) {
    linesA.push(`anchor ${gap}`);
    linesB.push(`anchor ${gap}`);

    for (let line = 0; line < 6000; line++) {
      linesA.push(gapLine());
      linesB.push(gapLine());
    }
  }

  const pair: TextPair = { a: linesA.join('\n'), b: linesB.join('\n') };

  return pair;
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

  it('GIVEN thousands of random text pairs WHEN each is diffed THEN applying the changes to the first gives the second', (): void => {
    const random = randomFrom(42);
    const pairs = Array.from({ length: 2000 }, (): TextPair => randomPair(random));

    const isRoundTrip = (pair: TextPair): boolean => {
      const changes = lineDiff(pair.a, pair.b);

      return applyChanges(pair.a, pair.b, changes) === pair.b;
    };

    expect(pairs.filter((pair: TextPair): boolean => !isRoundTrip(pair))).toStrictEqual([]);
  });

  it('GIVEN several gaps that are each slow to diff WHEN diffed THEN the whole diff keeps to one time budget', (): void => {
    const { a, b } = hardGaps(4);
    const started = performance.now();

    const changes = lineDiff(a, b);

    expect(performance.now() - started).toBeLessThan(1500);
    expect(applyChanges(a, b, changes)).toBe(b);
  });
});
