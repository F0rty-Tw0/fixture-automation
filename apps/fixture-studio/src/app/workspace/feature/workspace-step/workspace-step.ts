import { Component, ElementRef, afterRenderEffect, computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { MatTab, MatTabContent, MatTabGroup, MatTabLabel } from '@angular/material/tabs';

import { ApiErrorNotice } from '../../../shared/api-error/ui/api-error-notice/api-error-notice.ts';
import { DocumentView } from '../../../shared/document-view/ui/document-view/document-view.ts';
import { MethodBadge } from '../../../shared/method-badge/ui/method-badge/method-badge.ts';
import { FixtureGeneration } from '../../../spec/domain-logic/fixture-generation.service.ts';

/**
 * Step three: one tab per generated endpoint, each holding a sub-tab per document format. The chosen endpoint tab is
 * the endpoint that Compare, Missing values and AI fill follow.
 */
@Component({
  selector: 'fs-workspace-step',
  imports: [ApiErrorNotice, DocumentView, MatTab, MatTabContent, MatTabGroup, MatTabLabel, MethodBadge],
  templateUrl: './workspace-step.html',
  styleUrl: './workspace-step.scss'
})
export class WorkspaceStep {
  protected readonly generation = inject(FixtureGeneration);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly activeIndex: Signal<number> = computed(() => {
    const activeId = this.generation.activeEndpointId();
    const views = this.generation.views();
    const index = views.findIndex((view) => view.endpointId === activeId);

    return Math.max(index, 0);
  });

  /** The workspace opens below the endpoint list, usually off screen, so each finished generate brings it into view. */
  public constructor() {
    afterRenderEffect((): void => {
      const hasViews = this.generation.views().length > 0;

      if (!hasViews) return;

      this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  protected selectTab(index: number): void {
    const view = this.generation.views()[index];

    if (view === undefined) return;

    this.generation.selectEndpoint(view.endpointId);
  }
}
