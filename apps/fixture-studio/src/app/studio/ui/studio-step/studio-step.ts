import { Component, input } from '@angular/core';

import type { StepState } from '../../common/studio.type.ts';

/**
 * One station on the pipeline rail. The node on the rail shows whether the step is
 * waiting, active, or done; the step's content is projected.
 */
@Component({
  selector: 'fs-studio-step',
  templateUrl: './studio-step.html',
  styleUrl: './studio-step.scss',
  host: { '[attr.data-state]': 'state()', '[attr.aria-labelledby]': 'headingId()', role: 'region' }
})
export class StudioStep {
  public readonly heading = input.required<string>();
  public readonly headingId = input.required<string>();
  public readonly status = input('');
  public readonly state = input.required<StepState>();
}
