import { Component, computed, inject, input, output } from '@angular/core';
import type { Signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';

import type { DiffResult } from '@fixture-automation/fixture-studio-api/contract';

import type { FixtureView } from '../../../spec/common/generation.type.ts';
import { FixtureComparison } from '../../../workbench/domain-logic/fixture-comparison.service.ts';
import { BrokenValueList } from '../../ui/broken-value-list/broken-value-list.ts';
import { MissingPathList } from '../../ui/missing-path-list/missing-path-list.ts';

type BrokenChoice = 'fix' | 'keep';

/**
 * What the compare found, before any AI runs: the absent paths, grouped, and the present values that are broken. Broken
 * values are either rewritten by AI fill (the default) or kept as they are, which diffs again without them.
 */
@Component({
  selector: 'fs-missing-values-panel',
  imports: [BrokenValueList, MatButton, MatRadioButton, MatRadioGroup, MissingPathList],
  templateUrl: './missing-values-panel.html',
  styleUrl: './missing-values-panel.scss'
})
export class MissingValuesPanel {
  public readonly view = input.required<FixtureView>();
  public readonly result = input.required<DiffResult>();

  /** The user reviewed the missing values and moves on to AI fill. */
  public readonly continued = output();

  protected readonly comparison = inject(FixtureComparison);

  /** `missingPaths` holds every path a fill targets; the absent ones are those the diff did not replace. */
  protected readonly absentPaths: Signal<string[]> = computed(() => {
    const { missingPaths, replacedPaths } = this.result();
    const isAbsent = (path: string): boolean => !replacedPaths.includes(path);

    return missingPaths.filter(isAbsent);
  });

  protected readonly envelope: Signal<string | undefined> = computed(() => {
    const shape = this.comparison.form().objectShape.trim();

    return shape === '' ? undefined : shape;
  });

  protected readonly brokenChoice: Signal<BrokenChoice> = computed(() => {
    const isFixing = this.comparison.form().replacePlaceholders;

    return isFixing ? 'fix' : 'keep';
  });

  protected choose(choice: BrokenChoice): void {
    this.comparison.setReplacePlaceholders(this.view().endpointId, choice === 'fix');
  }
}
