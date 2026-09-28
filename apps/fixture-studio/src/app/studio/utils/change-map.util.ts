import type { ChangeMark, ChangedLines } from '../common/studio.type.ts';

/** Where each change sits along a document of `lineCount` lines, for the overview ruler beside a diff. */
export const changeMarks = (changes: ChangedLines[], lineCount: number): ChangeMark[] => {
  const total = Math.max(lineCount, 1);

  const markOf = (change: ChangedLines): ChangeMark => {
    const top = ((change.from - 1) / total) * 100;
    const height = ((change.to - change.from + 1) / total) * 100;
    const mark: ChangeMark = { top, height, line: change.from };

    return mark;
  };

  return changes.map(markOf);
};

/** The mark nearest to `percent` down the map, or -1 without marks; a click inside a mark picks that mark. */
export const nearestMark = (marks: ChangeMark[], percent: number): number => {
  const distanceTo = (mark: ChangeMark): number => {
    const bottom = mark.top + mark.height;

    if (percent < mark.top) return mark.top - percent;

    return Math.max(percent - bottom, 0);
  };

  const distances = marks.map(distanceTo);
  const closest = Math.min(...distances);

  return distances.indexOf(closest);
};
