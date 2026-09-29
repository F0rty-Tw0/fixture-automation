import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, linkedSignal, viewChild } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';

import type { DiffResult } from '@fixture-automation/fixture-studio-api/contract';

import { AiFillPanel } from '../../../ai-fill/feature/ai-fill-panel/ai-fill-panel.ts';
import { ComparePanel } from '../../../comparison/feature/compare-panel/compare-panel.ts';
import { MissingValuesPanel } from '../../../missing-values/feature/missing-values-panel/missing-values-panel.ts';
import { MethodBadge } from '../../../shared/method-badge/ui/method-badge/method-badge.ts';
import type { FixtureView } from '../../../spec/common/generation.type.ts';
import { FixtureGeneration } from '../../../spec/domain-logic/fixture-generation.service.ts';
import { FillProgress } from '../../../workbench/domain-logic/fill-progress.service.ts';
import { FixtureComparison } from '../../../workbench/domain-logic/fixture-comparison.service.ts';
import { provideFixtureWorkbench } from '../../../workbench/domain-logic/fixture-workbench.provider.ts';
import type { StudioProgress, StudioSteps } from '../../common/studio.type.ts';
import { StudioStep } from '../../ui/studio-step/studio-step.ts';
import { fillStatus, missingStatus } from '../../utils/step-status.util.ts';
import { studioSteps } from '../../utils/studio-steps.util.ts';

/**
 * Steps four to six (Compare, Missing & broken values, Fill with AI) for one generated endpoint. Every generated endpoint
 * has its own, with its own compare and fill state; only the endpoint chosen in Generate shows, the others keep theirs.
 * The host lays its steps straight onto the page's rail.
 */
@Component({
  selector: 'fs-endpoint-steps',
  imports: [AiFillPanel, ComparePanel, MatFormField, MatLabel, MatOption, MatSelect, MethodBadge, MissingValuesPanel, StudioStep],
  providers: [provideFixtureWorkbench()],
  templateUrl: './endpoint-steps.html',
  styleUrl: './endpoint-steps.scss',
  host: { '[hidden]': '!isActive()' }
})
export class EndpointSteps {
  public readonly view = input.required<FixtureView>();
  /** Position among the generated endpoints; keeps the step ids unique on the page. */
  public readonly index = input.required<number>();

  protected readonly generation = inject(FixtureGeneration);
  protected readonly comparison = inject(FixtureComparison);

  private readonly progress = inject(FillProgress);
  private readonly injector = inject(Injector);
  private readonly fillStep = viewChild.required<unknown, ElementRef<HTMLElement>>('fillStep', { read: ElementRef });

  /** Set by "Continue to AI fill"; a new diff asks the user to look at its missing values again first. */
  private readonly hasContinued: WritableSignal<boolean> = linkedSignal<DiffResult | undefined, boolean>({
    source: this.comparison.result,
    computation: (): boolean => false
  });

  protected readonly isActive: Signal<boolean> = computed(() => this.generation.activeEndpointId() === this.view().endpointId);

  protected readonly steps: Signal<StudioSteps> = computed(() => {
    const result = this.comparison.result();
    const hasFillWork = (result?.missingPaths.length ?? 0) > 0;
    const isFilling = hasFillWork && this.hasContinued();
    const hasMerge = this.progress.mergeResult() !== undefined;
    const progress: StudioProgress = { hasSpec: true, hasFixtures: true, hasDiff: result !== undefined, isFilling, hasMerge };

    return studioSteps(progress);
  });

  protected readonly missingStatus: Signal<string> = computed(() => missingStatus(this.comparison.result()));

  protected readonly fillStatus: Signal<string> = computed(() => {
    const result = this.comparison.result();

    return fillStatus(result, this.progress.isRunning(), this.progress.mergeResult());
  });

  protected selectEndpoint(endpointId: string): void {
    this.generation.selectEndpoint(endpointId);
  }

  /** Opens the AI step and brings it into view once it has rendered. */
  protected continueToFill(): void {
    const reveal = (): void => {
      this.fillStep().nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    this.hasContinued.set(true);
    afterNextRender(reveal, { injector: this.injector });
  }
}
