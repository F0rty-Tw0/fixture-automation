import { Component, computed, inject, input, signal } from '@angular/core';
import { MatTab, MatTabContent, MatTabGroup, MatTabLabel } from '@angular/material/tabs';

import type { FixtureView } from '../../common/studio.type.ts';
import { FixtureComparison } from '../../domain-logic/fixture-comparison.service.ts';
import { provideFixtureWorkbench } from '../../domain-logic/fixture-workbench.provider.ts';
import { DocumentView } from '../../ui/document-view/document-view.ts';
import { AiFillPanel } from '../ai-fill-panel/ai-fill-panel.ts';
import { ComparePanel } from '../compare-panel/compare-panel.ts';

/**
 * One endpoint's workbench: the generated documents, then compare and AI fill. It owns the compare
 * and fill state, so every endpoint tab keeps its own.
 */
@Component({
  selector: 'fs-fixture-workbench',
  imports: [AiFillPanel, ComparePanel, DocumentView, MatTab, MatTabContent, MatTabGroup, MatTabLabel],
  providers: [provideFixtureWorkbench()],
  templateUrl: './fixture-workbench.html',
  styleUrl: './fixture-workbench.scss'
})
export class FixtureWorkbench {
  public readonly view = input.required<FixtureView>();

  private readonly comparison = inject(FixtureComparison);

  protected readonly selectedTab = signal(0);

  /** AI fill opens once a compare found at least one missing path. */
  protected readonly canFill = computed(() => {
    const missing = this.comparison.result()?.missingPaths ?? [];

    return missing.length > 0;
  });

  /** Why AI fill is still closed, shown beside its tab label; the tab's accessible name stays "AI fill". */
  protected readonly fillHint = computed((): string | undefined => {
    if (this.canFill()) return undefined;

    const hasCompared = this.comparison.result() !== undefined;

    return hasCompared ? 'nothing missing' : 'compare first';
  });

  /** AI fill is the last tab, after one tab per document and Compare. */
  protected openAiFill(): void {
    this.selectedTab.set(this.view().documents.length + 1);
  }
}
