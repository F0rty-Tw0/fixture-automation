import { Component, ElementRef, afterRenderEffect, computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { MatTab, MatTabContent, MatTabGroup, MatTabLabel } from '@angular/material/tabs';

import { FixtureGeneration } from '../../domain-logic/fixture-generation.service.ts';
import { ApiErrorNotice } from '../../ui/api-error-notice/api-error-notice.ts';
import { DocumentView } from '../../ui/document-view/document-view.ts';
import { MethodBadge } from '../../ui/method-badge/method-badge.ts';

/**
 * Step three: one tab per generated endpoint, each holding its documents as folding sections. The chosen tab is the
 * endpoint that Compare, Missing values and AI fill follow.
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
