import { Component, ElementRef, afterRenderEffect, inject } from '@angular/core';
import { MatTab, MatTabContent, MatTabGroup, MatTabLabel } from '@angular/material/tabs';

import { FixtureGeneration } from '../../domain-logic/fixture-generation.service.ts';
import { ApiErrorNotice } from '../../ui/api-error-notice/api-error-notice.ts';
import { MethodBadge } from '../../ui/method-badge/method-badge.ts';
import { FixtureWorkbench } from '../fixture-workbench/fixture-workbench.ts';

/** Step three: one tab per generated endpoint; each tab holds that endpoint's documents. */
@Component({
  selector: 'fs-workspace-step',
  imports: [ApiErrorNotice, FixtureWorkbench, MatTab, MatTabContent, MatTabGroup, MatTabLabel, MethodBadge],
  templateUrl: './workspace-step.html',
  styleUrl: './workspace-step.scss'
})
export class WorkspaceStep {
  protected readonly generation = inject(FixtureGeneration);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The workspace opens below the endpoint list, usually off screen, so each finished generate brings it into view. */
  public constructor() {
    afterRenderEffect((): void => {
      const hasViews = this.generation.views().length > 0;

      if (!hasViews) return;

      this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
