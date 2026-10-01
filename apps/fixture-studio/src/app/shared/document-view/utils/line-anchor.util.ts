import type { LineAnchor, LineGap } from '../common/document-view.type.ts';

type Occurrence = {
  readonly count: number;
  readonly index: number;
};

/** How often each line code occurs, and where it last did: for a line seen once, where it is. */
const occurrencesOf = (codes: string): Map<string, Occurrence> => {
  const occurrences = new Map<string, Occurrence>();

  for (let index = 0; index < codes.length; index++) {
    const code = codes.charAt(index);
    const count = (occurrences.get(code)?.count ?? 0) + 1;
    const occurrence: Occurrence = { count, index };

    occurrences.set(code, occurrence);
  }

  return occurrences;
};

/** Lines that occur exactly once in each document, paired; a map keeps first-seen order, so they follow the first one. */
const uniquePairs = (codesA: string, codesB: string): LineAnchor[] => {
  const inA = occurrencesOf(codesA);
  const inB = occurrencesOf(codesB);
  const pairs: LineAnchor[] = [];

  for (const [code, occurrenceA] of inA) {
    const occurrenceB = inB.get(code);
    const isUnique = occurrenceA.count === 1 && occurrenceB?.count === 1;

    if (!isUnique) continue;

    const pair: LineAnchor = { a: occurrenceA.index, b: occurrenceB.index };

    pairs.push(pair);
  }

  return pairs;
};

/** Binary search: the first run length whose smallest tail is not below `b`, so a pair extends the run before it. */
const tailSlot = (pairs: LineAnchor[], tails: number[], b: number): number => {
  let low = 0;
  let high = tails.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    const tailB = pairs[tails[middle] ?? 0]?.b ?? 0;

    if (tailB < b) low = middle + 1;
    else high = middle;
  }

  return low;
};

/** The longest run of pairs whose `b` rises with `a` (patience sorting): pairs that cross cannot all be kept. */
const increasingPairs = (pairs: LineAnchor[]): LineAnchor[] => {
  const tails: number[] = [];
  const previous: number[] = [];

  for (const [index, pair] of pairs.entries()) {
    const low = tailSlot(pairs, tails, pair.b);

    previous[index] = tails[low - 1] ?? -1;
    tails[low] = index;
  }

  const kept: LineAnchor[] = [];

  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index] ?? -1) {
    const pair = pairs[index];

    if (pair !== undefined) kept.push(pair);
  }

  return kept.reverse();
};

/**
 * Lines a diff can pin both documents on (patience diff): each occurs once in either document, and they keep their order.
 * Diffing only the gaps between them stays fast however many values changed.
 */
const lineAnchors = (codesA: string, codesB: string): LineAnchor[] => {
  const pairs = uniquePairs(codesA, codesB);

  return increasingPairs(pairs);
};

const gapOf = (codesA: string, codesB: string, from: LineAnchor, to: LineAnchor): LineGap => {
  const fromA = from.a + 1;
  const fromB = from.b + 1;
  const gap: LineGap = { fromA, fromB, codesA: codesA.slice(fromA, to.a), codesB: codesB.slice(fromB, to.b) };

  return gap;
};

/** The runs of lines before, between and after the anchors: all a diff still has to compare. */
export const lineGaps = (codesA: string, codesB: string): LineGap[] => {
  const start: LineAnchor = { a: -1, b: -1 };
  const end: LineAnchor = { a: codesA.length, b: codesB.length };
  const unique = lineAnchors(codesA, codesB);
  const anchors = [start, ...unique, end];

  const gapBefore = (to: LineAnchor, index: number): LineGap => gapOf(codesA, codesB, anchors[index] ?? start, to);

  return anchors.slice(1).map(gapBefore);
};
