import { describe, expect, it } from 'vitest';

import { lineAnchors } from './line-anchor.util.ts';
import type { LineAnchor } from '../common/document-view.type.ts';

/** Each character stands for one line, as `lineDiff` encodes them. */
describe('FEATURE: line anchors', (): void => {
  it('GIVEN equal documents WHEN anchored THEN pins every line to itself', (): void => {
    const expected: LineAnchor[] = [
      { a: 0, b: 0 },
      { a: 1, b: 1 },
      { a: 2, b: 2 }
    ];

    expect(lineAnchors('abc', 'abc')).toStrictEqual(expected);
  });

  it('GIVEN a line repeated in one document WHEN anchored THEN never pins it', (): void => {
    const expected: LineAnchor[] = [{ a: 2, b: 1 }];

    expect(lineAnchors('aab', 'ab')).toStrictEqual(expected);
  });

  it('GIVEN unique lines that swapped places WHEN anchored THEN keeps only one, so anchors never cross', (): void => {
    expect(lineAnchors('ab', 'ba')).toHaveLength(1);
  });

  it('GIVEN a line in only one document WHEN anchored THEN pins nothing to it', (): void => {
    expect(lineAnchors('a', 'b')).toStrictEqual([]);
  });
});
