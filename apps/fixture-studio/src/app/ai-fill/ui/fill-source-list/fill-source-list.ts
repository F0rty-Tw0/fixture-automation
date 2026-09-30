import { Component, computed, input } from '@angular/core';
import type { Signal } from '@angular/core';

import type { FillSource } from '@fixture-automation/fixture-studio-api/contract';

import { FIX_OUTCOME_LABELS } from '../../../shared/document-view/common/document-view.const.ts';
import type { FilledPath } from '../../../workbench/common/ai-fill.type.ts';

/** Up to this many paths the list starts open; past it only the counts show until it is unfolded. */
const OPEN_LIMIT = 20;

const SOURCE_ORDER: FillSource[] = ['ai', 'sampler', 'unfilled'];

/** Every path a fill targeted with where its value came from: the model, the schema sampler, or nowhere yet. */
@Component({
  selector: 'fs-fill-source-list',
  templateUrl: './fill-source-list.html',
  styleUrl: './fill-source-list.scss'
})
export class FillSourceList {
  public readonly paths = input.required<FilledPath[]>();

  protected readonly labels = FIX_OUTCOME_LABELS;

  protected readonly isOpen: Signal<boolean> = computed(() => this.paths().length <= OPEN_LIMIT);

  /** How many values each source filled, e.g. `Filled by AI: 2 · Generated from the schema: 1`. */
  protected readonly counts: Signal<string> = computed(() => {
    const sources = this.paths().map((filled) => filled.source);

    const countOf = (source: FillSource): string => {
      const count = sources.filter((filled) => filled === source).length;

      if (count === 0) return '';

      return `${FIX_OUTCOME_LABELS[source]}: ${count}`;
    };

    const parts = SOURCE_ORDER.map(countOf);

    return parts.filter((part) => part !== '').join(' · ');
  });
}
