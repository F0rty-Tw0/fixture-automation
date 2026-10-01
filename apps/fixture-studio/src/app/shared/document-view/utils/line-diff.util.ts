import { Change, diff } from '@codemirror/merge';

import { lineAnchors } from './line-anchor.util.ts';
import type { LineAnchor } from '../common/document-view.type.ts';

/** Line ids become UTF-16 code units; the surrogate block is skipped because `diff` keeps surrogate pairs whole. */
const SURROGATE_START = 0xd800;
const SURROGATE_SIZE = 0x800;
const MAX_LINE_IDS = 0xffff - SURROGATE_SIZE;
/**
 * A line diff of wildly different documents falls back to a coarser match after this long, instead of freezing the page.
 * Each gap between anchors gets its own budget, so one hard gap never coarsens the rest.
 */
const LINE_DIFF_CONFIG = { timeout: 500 };
/** CodeMirror's own default: changed lines are short, and a huge rewritten block may be matched coarsely. */
const CHARACTER_DIFF_CONFIG = { scanLimit: 500 };

/** Lines keep their `\n`, so line offsets add up to character offsets. */
const linesOf = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];

const lineStarts = (lines: string[]): number[] => {
  let offset = 0;
  const ends = lines.map((line: string): number => (offset += line.length));

  return [0, ...ends];
};

const lineCode = (id: number): string => {
  const shiftedId = id + SURROGATE_SIZE;
  const code = id < SURROGATE_START ? id : shiftedId;

  return String.fromCharCode(code);
};

/** One character per line, the same character for the same line text in either document. */
const encodeLines = (lines: string[], ids: Map<string, number>): string => {
  const codes = lines.map((line: string): string => {
    const id = ids.get(line) ?? ids.size;

    ids.set(line, id);

    return lineCode(id);
  });

  return codes.join('');
};

/** Narrows a replaced block of lines to the characters that differ, e.g. only the comma a new sibling adds. */
const refine = (a: string, b: string, lines: Change): Change[] => {
  const isInsertOrDelete = lines.fromA === lines.toA || lines.fromB === lines.toB;

  if (isInsertOrDelete) return [lines];

  const textA = a.slice(lines.fromA, lines.toA);
  const textB = b.slice(lines.fromB, lines.toB);
  const changes = diff(textA, textB, CHARACTER_DIFF_CONFIG);

  return changes.map(
    (change: Change): Change =>
      new Change(change.fromA + lines.fromA, change.toA + lines.fromA, change.fromB + lines.fromB, change.toB + lines.fromB)
  );
};

/** The line changes between two anchors, by line index in either whole document. */
const gapChanges = (codesA: string, codesB: string, from: LineAnchor, to: LineAnchor): Change[] => {
  const fromA = from.a + 1;
  const fromB = from.b + 1;
  const gapA = codesA.slice(fromA, to.a);
  const gapB = codesB.slice(fromB, to.b);

  if (gapA === gapB) return [];

  const changes = diff(gapA, gapB, LINE_DIFF_CONFIG);

  return changes.map(
    (change: Change): Change => new Change(change.fromA + fromA, change.toA + fromA, change.fromB + fromB, change.toB + fromB)
  );
};

/**
 * Line changes, diffed gap by gap between lines unique to both documents: one diff over the whole of a large fixture with
 * thousands of edits runs out of time and marks everything after that point as one changed block.
 */
const anchoredLineChanges = (codesA: string, codesB: string): Change[] => {
  const start: LineAnchor = { a: -1, b: -1 };
  const end: LineAnchor = { a: codesA.length, b: codesB.length };
  const unique = lineAnchors(codesA, codesB);
  const anchors = [start, ...unique, end];

  const changesBefore = (to: LineAnchor, index: number): Change[] => gapChanges(codesA, codesB, anchors[index] ?? start, to);

  return anchors.slice(1).flatMap(changesBefore);
};

/**
 * `diff` override for the merge view. CodeMirror's default character diff gives up past a few
 * thousand changed characters and marks everything between two distant edits as changed; diffing
 * whole lines first keeps a large fixture's diff down to the lines that actually changed.
 */
export const lineDiff = (a: string, b: string): Change[] => {
  const linesA = linesOf(a);
  const linesB = linesOf(b);
  const ids = new Map<string, number>();
  const codesA = encodeLines(linesA, ids);
  const codesB = encodeLines(linesB, ids);

  // ponytail: more distinct lines than code units; falls back to CodeMirror's coarse character diff.
  if (ids.size > MAX_LINE_IDS) {
    const changes = diff(a, b, CHARACTER_DIFF_CONFIG);

    return [...changes];
  }

  const startsA = lineStarts(linesA);
  const startsB = lineStarts(linesB);
  const lineChanges = anchoredLineChanges(codesA, codesB);

  return lineChanges.flatMap((change: Change): Change[] => {
    const lines = new Change(
      startsA[change.fromA] ?? 0,
      startsA[change.toA] ?? 0,
      startsB[change.fromB] ?? 0,
      startsB[change.toB] ?? 0
    );

    return refine(a, b, lines);
  });
};
