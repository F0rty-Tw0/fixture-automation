import { Component, computed, inject, input, output } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';

import type { FixtureDocument, FixtureView } from '../../common/studio.type.ts';
import { FixtureComparison } from '../../domain-logic/fixture-comparison.service.ts';
import { ApiErrorNotice } from '../../ui/api-error-notice/api-error-notice.ts';
import { DocumentView } from '../../ui/document-view/document-view.ts';
import { FileDrop } from '../../ui/file-drop/file-drop.ts';
import { MissingPathList } from '../../ui/missing-path-list/missing-path-list.ts';
import { jsonDocument } from '../../utils/fixture-document.util.ts';

/** Compares an existing fixture, read locally from a file or pasted text, with what the schema expects. */
@Component({
  selector: 'fs-compare-panel',
  imports: [
    ApiErrorNotice,
    DocumentView,
    FileDrop,
    FormField,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatProgressBar,
    MissingPathList
  ],
  templateUrl: './compare-panel.html',
  styleUrl: './compare-panel.scss'
})
export class ComparePanel {
  public readonly view = input.required<FixtureView>();

  /** The user wants the missing values filled; the workbench opens its AI fill tab. */
  public readonly fillRequested = output();

  protected readonly comparison = inject(FixtureComparison);
  protected readonly compareForm = form(this.comparison.form);

  /** The schema-complete fixture, shown as a diff against the existing one. */
  protected readonly completeDocument = computed((): FixtureDocument | undefined => {
    const result = this.comparison.result();

    if (result === undefined) return undefined;

    return jsonDocument('Complete fixture', `${this.view().schemaName}.complete.json`, result.completeJson);
  });

  /** `missingPaths` holds every path a fill targets; the absent ones are those the diff did not replace. */
  protected readonly absentPaths = computed((): string[] => {
    const result = this.comparison.result();

    if (result === undefined) return [];

    const isAbsent = (path: string): boolean => !result.replacedPaths.includes(path);

    return result.missingPaths.filter(isAbsent);
  });

  protected readonly hasPasted = computed(() => this.comparison.form().pasted.trim() !== '');

  /** The diff on screen answers the form as it stands; otherwise compare is the primary action again. */
  protected readonly isCurrent = computed(() => this.comparison.isCurrent(this.view().endpointId));

  /** A fixture is compared as soon as it is read; the button re-runs it after an option changes. */
  protected async readFile(file: File): Promise<void> {
    await this.comparison.readFile(file);
    this.compareRead();
  }

  protected async readPasted(): Promise<void> {
    await this.comparison.readPasted();
    this.compareRead();
  }

  protected compare(): void {
    this.comparison.compare(this.view().endpointId);
  }

  /** A rejected read leaves the previous fixture loaded; that one must not be compared as if it were the new one. */
  private compareRead(): void {
    const sourceError = this.comparison.sourceError();
    const isRejected = sourceError !== undefined;

    if (isRejected) return;

    this.compare();
  }
}
