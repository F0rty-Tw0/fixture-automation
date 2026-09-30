import { Service, computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';

import type { DiffResult } from '@fixture-automation/fixture-studio-api/contract';

import type { LineHighlight } from '../../shared/document-view/common/document-view.type.ts';
import { lineHighlights } from '../../shared/document-view/utils/line-highlight.util.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';
import { brokenHighlights, errorHighlights, payloadEnvelope, targetHighlights } from '../utils/fix-highlight.util.ts';

/** Which lines of each shown document hold a broken value, and how each value the compare or fill targeted was fixed. */
@Service({ autoProvided: false })
export class FixHighlights {
  private readonly comparison = inject(ComparisonStore);
  private readonly fill = inject(AiFillStore);

  private readonly result: Signal<DiffResult | undefined> = computed(() => {
    if (!this.comparison.diff.hasValue()) return undefined;

    return this.comparison.diff.value();
  });

  /** The existing fixture: its broken values. */
  public readonly existing: Signal<LineHighlight[]> = computed(() => {
    const result = this.result();
    const existing = this.comparison.existing();

    if (result === undefined || existing === undefined) return [];

    return lineHighlights(existing.pretty, brokenHighlights(result));
  });

  /** The schema-complete fixture: every target filled by the sampler, and the broken values the user kept. */
  public readonly complete: Signal<LineHighlight[]> = computed(() => {
    const result = this.result();

    if (result === undefined) return [];

    return lineHighlights(result.completeJson, targetHighlights(result, {}, 'sampler'));
  });

  /**
   * The merged fixture: every target by the source the merged answer gave it, then every value the merge found invalid,
   * as still broken.
   */
  public readonly merged: Signal<LineHighlight[]> = computed(() => {
    const result = this.result();
    const merged = this.fill.merged();

    if (result === undefined || merged === undefined) return [];

    const { answer, merge } = merged;
    const sources = answer.sources ?? {};
    const body = this.comparison.compared()?.body;
    const envelope = payloadEnvelope(body?.fixture, body?.objectShape);
    const targets = targetHighlights(result, sources, 'ai');
    const errors = errorHighlights(merge.errors, result, envelope);

    return lineHighlights(merge.mergedJson, [...targets, ...errors]);
  });
}
