import { Change, diff } from '@codemirror/merge';

import { lineGaps } from './line-anchor.util.ts';
import type { LineGap } from '../common/document-view.type.ts';

/** Line ids become UTF-16 code units; the surrogate block is skipped because `diff` keeps surrogate pairs whole. */
const SURROGATE_START = 0xd800;
const SURROGATE_SIZE = 0x800;
const MAX_LINE_IDS = 0xffff - SURROGATE_SIZE;
/**
 * A line diff of wildly different documents falls back to a coarser match after this long, instead of freezing the page.
 * The whole diff shares it between the gaps between anchors, so many hard gaps never add up.
 */
const LINE_DIFF_BUDGET_MS = 500;
/** CodeMirror reads a zero timeout as none, so a gap whose share rounds down to zero still gets one millisecond. */
const MIN_GAP_TIMEOUT_MS = 1;
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

const gapSize = (gap: LineGap): number => gap.codesA.length + gap.codesB.length;

/** The line changes inside one gap, by line index in either whole document, found within `timeout` milliseconds. */
const gapChanges = (gap: LineGap, timeout: number): Change[] => {
  if (gap.codesA === gap.codesB) return [];

  const changes = diff(gap.codesA, gap.codesB, { timeout });
  const { fromA, fromB } = gap;

  return changes.map(
    (change: Change): Change => new Change(change.fromA + fromA, change.toA + fromA, change.fromB + fromB, change.toB + fromB)
  );
};

/**
 * Line changes, diffed gap by gap between lines unique to both documents: one diff over the whole of a large fixture with
 * thousands of edits runs out of time and marks everything after that point as one changed block. Each gap gets the share
 * of the time budget its size earns, so many hard gaps together still keep to about one budget.
 */
const anchoredLineChanges = (codesA: string, codesB: string): Change[] => {
  const gaps = lineGaps(codesA, codesB);
  const totalSize = gaps.reduce((total: number, gap: LineGap): number => total + gapSize(gap), 0);

  const changesIn = (gap: LineGap): Change[] => {
    const share = Math.floor((LINE_DIFF_BUDGET_MS * gapSize(gap)) / Math.max(totalSize, 1));
    const timeout = Math.max(share, MIN_GAP_TIMEOUT_MS);

    return gapChanges(gap, timeout);
  };

  return gaps.flatMap(changesIn);
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
