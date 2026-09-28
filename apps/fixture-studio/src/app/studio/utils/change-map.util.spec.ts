import { describe, expect, it } from 'vitest';

import { changeMarks, nearestMark } from './change-map.util.ts';
import type { ChangeMark, ChangedLines } from '../common/studio.type.ts';

describe('FEATURE: change map marks', (): void => {
  it('GIVEN changes in a 100-line document WHEN mapped THEN each mark sits at its share of the height', (): void => {
    const changes: ChangedLines[] = [
      { from: 1, to: 1 },
      { from: 51, to: 60 }
    ];
    const expected: ChangeMark[] = [
      { top: 0, height: 1, line: 1 },
      { top: 50, height: 10, line: 51 }
    ];

    expect(changeMarks(changes, 100)).toStrictEqual(expected);
  });

  it('GIVEN no changes WHEN mapped THEN there are no marks', (): void => {
    expect(changeMarks([], 100)).toStrictEqual([]);
  });

  it('GIVEN an empty document WHEN mapped THEN counts it as one line instead of dividing by zero', (): void => {
    const changes: ChangedLines[] = [{ from: 1, to: 1 }];

    expect(changeMarks(changes, 0)).toStrictEqual([{ top: 0, height: 100, line: 1 }]);
  });
});

describe('FEATURE: change map picking', (): void => {
  const marks: ChangeMark[] = [
    { top: 10, height: 5, line: 11 },
    { top: 60, height: 10, line: 61 }
  ];

  it.each([
    ['inside the second mark', 65, 1],
    ['above every mark', 0, 0],
    ['nearer the second mark', 50, 1],
    ['nearer the first mark', 30, 0]
  ])('GIVEN a click %s WHEN picked THEN picks mark %s', (_label, percent, expected): void => {
    expect(nearestMark(marks, percent)).toBe(expected);
  });

  it('GIVEN no marks WHEN picked THEN picks none', (): void => {
    expect(nearestMark([], 50)).toBe(-1);
  });
});
