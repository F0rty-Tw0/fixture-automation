import { describe, expect, it } from 'vitest';

import { lineGaps } from './line-anchor.util.ts';
import type { LineGap } from '../common/document-view.type.ts';

/** Each character stands for one line, as `lineDiff` encodes them; a gap is what is left to compare between anchors. */
describe('FEATURE: line gaps', (): void => {
  it('GIVEN equal documents WHEN split THEN pins every line, leaving only empty gaps', (): void => {
    const gaps = lineGaps('abc', 'abc');

    const isEmpty = (gap: LineGap): boolean => gap.codesA === '' && gap.codesB === '';

    expect(gaps).toHaveLength(4);
    expect(gaps.every(isEmpty)).toBe(true);
  });

  it('GIVEN one changed line between equal ones WHEN split THEN leaves only that line to compare', (): void => {
    const expected: LineGap[] = [
      { fromA: 0, fromB: 0, codesA: '', codesB: '' },
      { fromA: 1, fromB: 1, codesA: 'b', codesB: 'x' },
      { fromA: 3, fromB: 3, codesA: '', codesB: '' }
    ];

    expect(lineGaps('abc', 'axc')).toStrictEqual(expected);
  });

  it('GIVEN a line repeated in one document WHEN split THEN never pins it', (): void => {
    const expected: LineGap[] = [
      { fromA: 0, fromB: 0, codesA: 'aa', codesB: 'a' },
      { fromA: 3, fromB: 2, codesA: '', codesB: '' }
    ];

    expect(lineGaps('aab', 'ab')).toStrictEqual(expected);
  });

  it('GIVEN unique lines that swapped places WHEN split THEN pins only one, so gaps never cross', (): void => {
    expect(lineGaps('ab', 'ba')).toHaveLength(2);
  });

  it('GIVEN no line in both documents WHEN split THEN leaves one gap holding everything', (): void => {
    const expected: LineGap[] = [{ fromA: 0, fromB: 0, codesA: 'a', codesB: 'b' }];

    expect(lineGaps('a', 'b')).toStrictEqual(expected);
  });
});
