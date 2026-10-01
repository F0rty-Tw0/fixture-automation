import { Service, computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';

import type { MergeResult } from '@fixture-automation/fixture-studio-api/contract';

import { AiFillStore } from '../data-access/ai-fill.store.ts';

/**
 * How far one endpoint's AI fill got: running, and the merge of its answer. Reading it starts nothing, unlike
 * `FixtureAiFill`, whose CLI install check and model discovery run as soon as it exists.
 */
@Service({ autoProvided: false })
export class FillProgress {
  private readonly store = inject(AiFillStore);

  public readonly isRunning: Signal<boolean> = this.store.run.isLoading;

  /** The merge of the current run; a new run drops the previous one at once. */
  public readonly mergeResult: Signal<MergeResult | undefined> = computed(() => this.store.merged()?.merge);
}
