import { Component, computed, inject, input } from '@angular/core';
import type { Signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect } from '@angular/material/select';

import { ApiErrorNotice } from '../../../shared/api-error/ui/api-error-notice/api-error-notice.ts';
import type { FixtureDocument } from '../../../shared/document-view/common/document-view.type.ts';
import { DocumentView } from '../../../shared/document-view/ui/document-view/document-view.ts';
import { jsonDocument } from '../../../shared/document-view/utils/json-document.util.ts';
import { FileDrop } from '../../../shared/file-drop/ui/file-drop/file-drop.ts';
import type { FixtureView } from '../../../spec/common/generation.type.ts';
import { FixtureComparison } from '../../../workbench/domain-logic/fixture-comparison.service.ts';

/**
 * Compares an existing fixture, read locally from a file or pasted text, with what the schema expects. The envelope
 * property is detected on read; the diff shows the fixture beside its schema-complete version.
 */
@Component({
  selector: 'fs-compare-panel',
  imports: [
    ApiErrorNotice,
    DocumentView,
    FileDrop,
    FormField,
    MatButton,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatOption,
    MatProgressBar,
    MatSelect
  ],
  templateUrl: './compare-panel.html',
  styleUrl: './compare-panel.scss'
})
export class ComparePanel {
  public readonly view = input.required<FixtureView>();

  protected readonly comparison = inject(FixtureComparison);
  protected readonly compareForm = form(this.comparison.form);

  /** The schema-complete fixture, shown as a diff against the existing one. */
  protected readonly completeDocument = computed((): FixtureDocument | undefined => {
    const result = this.comparison.result();

    if (result === undefined) return undefined;

    return jsonDocument('Complete fixture', `${this.view().schemaName}.complete.json`, result.completeJson);
  });

  /** The API's candidates, plus the chosen property when it is not one of them, so the select can always show it. */
  protected readonly envelopeOptions: Signal<string[]> = computed(() => {
    const candidates = this.comparison.envelopes();
    const chosen = this.comparison.form().objectShape;
    const isCandidate = candidates.includes(chosen);
    const isOffered = chosen === '' || isCandidate;

    if (isOffered) return candidates;

    return [chosen, ...candidates];
  });

  protected readonly hasPasted = computed(() => this.comparison.form().pasted.trim() !== '');

  /** The diff on screen answers the form as it stands; otherwise compare is the primary action again. */
  protected readonly isCurrent = computed(() => this.comparison.isCurrent(this.view().endpointId));

  protected async readFile(file: File): Promise<void> {
    await this.comparison.compareFile(file, this.view().endpointId);
  }

  protected async readPasted(): Promise<void> {
    await this.comparison.comparePasted(this.view().endpointId);
  }

  protected compare(): void {
    this.comparison.compare(this.view().endpointId);
  }
}
