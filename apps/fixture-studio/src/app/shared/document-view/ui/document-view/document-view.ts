import { Component, computed, input } from '@angular/core';
import type { Signal } from '@angular/core';

import {
  FIX_ORIGIN_LABELS,
  FIX_ORIGIN_MARKERS,
  FIX_ORIGIN_ORDER,
  FIX_OUTCOME_LABELS,
  FIX_OUTCOME_MARKERS,
  FIX_OUTCOME_ORDER
} from '../../common/document-view.const.ts';
import type { FixOrigin, FixOutcome, FixtureDocument, LineHighlight } from '../../common/document-view.type.ts';
import { CodeView } from '../code-view/code-view.ts';
import { CopyExportBar } from '../copy-export-bar/copy-export-bar.ts';

/** One document: file bar with copy/export, then the editor, loaded lazily together with CodeMirror. */
@Component({
  selector: 'fs-document-view',
  imports: [CodeView, CopyExportBar],
  templateUrl: './document-view.html',
  styleUrl: './document-view.scss'
})
export class DocumentView {
  public readonly document = input.required<FixtureDocument>();
  /** When set, the editor shows it beside `document` as a side-by-side diff. */
  public readonly original = input<string | undefined>(undefined);
  /** Lines of `document` to mark as broken or fixed; a legend explains the marks on screen. */
  public readonly highlights = input<LineHighlight[]>([]);
  /** Lines of `original` to mark, shown only in a diff. */
  public readonly originalHighlights = input<LineHighlight[]>([]);

  protected readonly outcomeLabels = FIX_OUTCOME_LABELS;
  protected readonly originLabels = FIX_ORIGIN_LABELS;
  protected readonly originMarkers = FIX_ORIGIN_MARKERS;
  protected readonly outcomeMarkers = FIX_OUTCOME_MARKERS;

  private readonly shownHighlights: Signal<LineHighlight[]> = computed(() => {
    const highlights = this.highlights();
    const isDiff = this.original() !== undefined;

    if (!isDiff) return highlights;

    const originalHighlights = this.originalHighlights();

    return [...originalHighlights, ...highlights];
  });

  /** The outcomes on screen, in legend order. */
  protected readonly legendOutcomes: Signal<FixOutcome[]> = computed(() => {
    const shown = new Set(this.shownHighlights().map((highlight) => highlight.outcome));

    return FIX_OUTCOME_ORDER.filter((outcome) => shown.has(outcome));
  });

  /** The gutter glyphs on screen, in legend order. */
  protected readonly legendOrigins: Signal<FixOrigin[]> = computed(() => {
    const shown = new Set(this.shownHighlights().map((highlight) => highlight.origin));

    return FIX_ORIGIN_ORDER.filter((origin) => shown.has(origin));
  });
}
