import { Component, computed, input, linkedSignal } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';

import type { StepState } from '../../common/studio.type.ts';

/** A step opens whenever it becomes the active one; otherwise it keeps what it was, or what the user chose. */
const expandedFor = (state: StepState, previous: boolean | undefined): boolean => {
  if (state === 'active') return true;

  return previous ?? true;
};

/**
 * One station on the pipeline rail. The node on the rail shows whether the step is waiting, active, or done; the
 * heading is a toggle that folds the projected content away. A folded body stays searchable: find-in-page opens it.
 */
@Component({
  selector: 'fs-studio-step',
  templateUrl: './studio-step.html',
  styleUrl: './studio-step.scss',
  host: {
    '[attr.data-state]': 'state()',
    '[attr.data-expanded]': 'isExpanded()',
    '[attr.aria-labelledby]': 'headingId()',
    '[class.step--last]': 'isLast()',
    role: 'region'
  }
})
export class StudioStep {
  public readonly heading = input.required<string>();
  public readonly headingId = input.required<string>();
  public readonly status = input('');
  public readonly state = input.required<StepState>();
  /** The last step draws no rail line below its node. */
  public readonly isLast = input(false);

  protected readonly isExpanded: WritableSignal<boolean> = linkedSignal<StepState, boolean>({
    source: this.state,
    computation: (state, previous) => expandedFor(state, previous?.value)
  });

  protected readonly bodyId: Signal<string> = computed(() => `${this.headingId()}-body`);

  protected toggle(): void {
    this.isExpanded.update((isExpanded) => !isExpanded);
  }

  protected expand(): void {
    this.isExpanded.set(true);
  }
}
