import { Service, computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';

import type { FilledPath } from '../common/ai-fill.type.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';
import { prettyJson } from '../utils/fixture-source.util.ts';

/** What one endpoint's AI fill came to: where each value came from, what the fill noted, and what stands in when it fails. */
@Service({ autoProvided: false })
export class FillOutcome {
  private readonly store = inject(AiFillStore);
  private readonly comparison = inject(ComparisonStore);

  /** Plain-language notes from the answer on screen, e.g. why part of it came from the schema sampler. */
  public readonly notes: Signal<string[]> = computed(() => this.store.shownAnswer()?.notes ?? []);

  /** The answer on screen as JSON: shown even when merging it failed. */
  public readonly filledJson: Signal<string | undefined> = computed(() => {
    const answer = this.store.shownAnswer();

    if (answer === undefined) return undefined;

    return prettyJson(answer.populated);
  });

  /** Every path the fill targeted and where the answer on screen got its value; an answer without sources is the model's alone. */
  public readonly filledPaths: Signal<FilledPath[]> = computed(() => {
    const answer = this.store.shownAnswer();

    if (answer === undefined) return [];

    if (!this.comparison.diff.hasValue()) return [];

    const sources = answer.sources ?? {};

    const filledPathOf = (path: string): FilledPath => {
      const filled: FilledPath = { path, source: sources[path] ?? 'ai' };

      return filled;
    };

    return this.comparison.diff.value().missingPaths.map(filledPathOf);
  });

  /**
   * The diff's schema-complete fixture, offered when the fill or its merge failed, or the fill was cancelled, and this
   * run has no merge to show: the user always leaves with a fixture.
   */
  public readonly fallbackJson: Signal<string | undefined> = computed(() => {
    const runStatus = this.store.run.status();
    const mergeStatus = this.store.merge.status();
    const isCancelled = this.store.isCancelled();
    const hasFailed = runStatus === 'error' || mergeStatus === 'error' || isCancelled;
    const merged = this.store.merged();

    if (!hasFailed || merged !== undefined) return undefined;

    if (!this.comparison.diff.hasValue()) return undefined;

    return this.comparison.diff.value().completeJson;
  });
}
