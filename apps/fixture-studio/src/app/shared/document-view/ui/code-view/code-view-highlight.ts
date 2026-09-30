import { RangeSet, StateEffect, StateField } from '@codemirror/state';
import type { Extension, Range, Text, Transaction, TransactionSpec } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutter } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';

import { FIX_ORIGIN_MARKERS, FIX_OUTCOME_MARKERS } from '../../common/document-view.const.ts';
import type { LineHighlight } from '../../common/document-view.type.ts';

type HighlightState = {
  readonly lines: DecorationSet;
  readonly markers: RangeSet<GutterMarker>;
};

/** The origin glyph beside a highlighted value's first line, coloured by its outcome and titled like the line. */
class FixMarker extends GutterMarker {
  private readonly highlight: LineHighlight;

  public constructor(highlight: LineHighlight) {
    super();
    this.highlight = highlight;
  }

  public override eq(other: GutterMarker): boolean {
    return other instanceof FixMarker && other.highlight === this.highlight;
  }

  public override toDOM(): Node {
    const marker = document.createElement('span');

    marker.className = `cm-fixMarker cm-fix-${this.highlight.outcome}`;
    marker.textContent = `${FIX_ORIGIN_MARKERS[this.highlight.origin]}${FIX_OUTCOME_MARKERS[this.highlight.outcome]}`;
    marker.title = this.highlight.label;

    return marker;
  }
}

const NO_MARKERS = RangeSet.of<GutterMarker>([]);

const NO_HIGHLIGHTS: HighlightState = { lines: Decoration.none, markers: NO_MARKERS };

const setHighlights = StateEffect.define<LineHighlight[]>();

const spanOf = (highlight: LineHighlight): number => highlight.to - highlight.from;

const widerFirst = (first: LineHighlight, second: LineHighlight): number => spanOf(second) - spanOf(first);

/**
 * One entry per line. Wider values paint first, so a child inside a highlighted parent (a `required` error on its
 * object) keeps its own mark; among equal spans a later highlight wins, so callers list the most telling one last.
 */
const highlightsByLine = (doc: Text, highlights: LineHighlight[]): Map<number, LineHighlight> => {
  const byLine = new Map<number, LineHighlight>();
  const painted = highlights.toSorted(widerFirst);

  for (const highlight of painted) {
    const to = Math.min(highlight.to, doc.lines);

    for (let line = highlight.from; line <= to; line++) byLine.set(line, highlight);
  }

  return byLine;
};

const highlightStateOf = (doc: Text, highlights: LineHighlight[]): HighlightState => {
  const lines: Range<Decoration>[] = [];
  const markers: Range<GutterMarker>[] = [];

  const byLine = highlightsByLine(doc, highlights);

  for (const [number, highlight] of byLine) {
    const { from } = doc.line(number);
    const attributes = { title: highlight.label };
    const decoration = Decoration.line({ class: `cm-fix cm-fix-${highlight.outcome}`, attributes });

    lines.push(decoration.range(from));

    if (number === highlight.from) {
      const marker = new FixMarker(highlight);

      markers.push(marker.range(from));
    }
  }

  const lineSet = Decoration.set(lines, true);
  const markerSet = RangeSet.of(markers, true);
  const state: HighlightState = { lines: lineSet, markers: markerSet };

  return state;
};

const updateHighlights = (value: HighlightState, transaction: Transaction): HighlightState => {
  for (const effect of transaction.effects) {
    if (effect.is(setHighlights)) return highlightStateOf(transaction.state.doc, effect.value);
  }

  if (transaction.docChanged) return NO_HIGHLIGHTS;

  return value;
};

/** Line highlights follow the document they were computed for; a new document drops them until they are set again. */
const highlightField = StateField.define<HighlightState>({
  create: (): HighlightState => NO_HIGHLIGHTS,
  update: updateHighlights,
  provide: (field): Extension => {
    const lines = EditorView.decorations.from(field, (state): DecorationSet => state.lines);
    const markers = gutter({ class: 'cm-fixGutter', markers: (view): RangeSet<GutterMarker> => view.state.field(field).markers });

    return [lines, markers];
  }
});

export const highlightExtension: Extension = highlightField;

/** A transaction that shows `highlights` on the editor's current (or, dispatched with a new document, next) text. */
export const showHighlights = (highlights: LineHighlight[]): TransactionSpec => {
  const effects = setHighlights.of(highlights);
  const spec: TransactionSpec = { effects };

  return spec;
};
