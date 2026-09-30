import { Component, computed, input } from '@angular/core';
import type { Signal } from '@angular/core';

import type { MergeResult } from '@fixture-automation/fixture-studio-api/contract';

import type { FixtureDocument, LineHighlight } from '../../../shared/document-view/common/document-view.type.ts';
import { DocumentView } from '../../../shared/document-view/ui/document-view/document-view.ts';
import { jsonDocument } from '../../../shared/document-view/utils/json-document.util.ts';
import type { FilledPath } from '../../../workbench/common/ai-fill.type.ts';
import { FillSourceList } from '../fill-source-list/fill-source-list.ts';

/** A merged fill: whether it is valid, where each value came from, and the merged fixture beside the existing one. */
@Component({
  selector: 'fs-merge-result',
  imports: [DocumentView, FillSourceList],
  templateUrl: './merge-result.html',
  styleUrl: './merge-result.scss',
  host: { role: 'region', 'aria-label': 'Merge result' }
})
export class MergeResultView {
  public readonly merge = input.required<MergeResult>();
  public readonly fileName = input.required<string>();
  public readonly filledPaths = input.required<FilledPath[]>();
  public readonly highlights = input<LineHighlight[]>([]);
  public readonly original = input<string | undefined>(undefined);
  public readonly originalHighlights = input<LineHighlight[]>([]);

  protected readonly document: Signal<FixtureDocument> = computed(() => {
    return jsonDocument('Merged fixture', this.fileName(), this.merge().mergedJson);
  });
}
