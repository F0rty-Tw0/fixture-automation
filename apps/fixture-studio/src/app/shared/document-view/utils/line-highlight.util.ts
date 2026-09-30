import { pathSegments } from '../../json/utils/json-path.util.ts';
import { parseJsonOrUndefined } from '../../json/utils/json.util.ts';
import { isRecord } from '../../json/utils/record.util.ts';
import { FIX_ORIGIN_LABELS, FIX_OUTCOME_LABELS } from '../common/document-view.const.ts';
import type { ChangedLines, LineHighlight, PathHighlight } from '../common/document-view.type.ts';

type PathLines = Map<string, ChangedLines>;

const childEntries = (value: unknown): [string, unknown][] => {
  if (Array.isArray(value)) return value.map((item: unknown, index: number): [string, unknown] => [String(index), item]);

  if (!isRecord(value)) return [];

  return Object.entries(value);
};

/** Keyed by every segment, so `a.b`, `a/b` and `k[0]` as keys never collide with nested look-alikes. */
const keyOf = (segments: string[]): string => JSON.stringify(segments);

/** Records the lines of `value` and its children, starting at line `from`; returns the value's last line. */
const recordLines = (value: unknown, segments: string[], from: number, lines: PathLines): number => {
  const children = childEntries(value);
  let next = from + 1;

  for (const [segment, child] of children) {
    const childSegments = [...segments, segment];

    next = recordLines(child, childSegments, next, lines) + 1;
  }

  const to = children.length === 0 ? from : next;
  const span: ChangedLines = { from, to };

  lines.set(keyOf(segments), span);

  return to;
};

/**
 * The lines every value of a 2-space pretty-printed JSON document covers, keyed by its path segments. The layout is
 * `JSON.stringify(value, null, 2)`'s, which `completeJson` and `mergedJson` follow; text that is not JSON maps nothing.
 */
const jsonPathLines = (content: string): PathLines => {
  const lines: PathLines = new Map();
  const value = parseJsonOrUndefined(content);

  if (value !== undefined) recordLines(value, [], 1, lines);

  return lines;
};

const labelOf = (highlight: PathHighlight): string => {
  const outcome = FIX_OUTCOME_LABELS[highlight.outcome];

  if (highlight.outcome === 'broken') return `${highlight.path} · ${outcome}`;

  return `${highlight.path} · ${FIX_ORIGIN_LABELS[highlight.origin]} · ${outcome}`;
};

/**
 * Where each highlighted path sits in a pretty-printed JSON document; paths the document lacks are left out, and so is
 * a path naming the root, which would mark the whole document.
 */
export const lineHighlights = (content: string, highlights: PathHighlight[]): LineHighlight[] => {
  if (highlights.length === 0) return [];

  const lines = jsonPathLines(content);

  const lineHighlightOf = (highlight: PathHighlight): LineHighlight[] => {
    const segments = pathSegments(highlight.path);
    const span = lines.get(keyOf(segments));

    if (span === undefined || segments.length === 0) return [];

    const label = labelOf(highlight);
    const line: LineHighlight = { ...span, origin: highlight.origin, outcome: highlight.outcome, label };

    return [line];
  };

  return highlights.flatMap(lineHighlightOf);
};
