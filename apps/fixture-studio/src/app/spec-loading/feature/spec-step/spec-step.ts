import { Component, inject, signal } from '@angular/core';
import { FormField, form, pattern, required } from '@angular/forms/signals';
import type { SchemaPathTree } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';

import { ApiErrorNotice } from '../../../shared/api-error/ui/api-error-notice/api-error-notice.ts';
import { FileDrop } from '../../../shared/file-drop/ui/file-drop/file-drop.ts';
import { SpecBrowser } from '../../../spec/domain-logic/spec-browser.service.ts';
import type { SpecSource } from '../../common/spec-loading.type.ts';
import { parseSpecDocument } from '../../utils/spec-document.util.ts';

const HTTP_URL = /^https?:\/\/\S+$/iu;

const specSourceSchema = (path: SchemaPathTree<SpecSource>): void => {
  required(path.url, { message: 'Enter the URL of an OpenAPI JSON document.' });
  pattern(path.url, HTTP_URL, { message: 'Use an http:// or https:// URL.' });
};

/** Step one: point the studio at a spec, by URL or by a local JSON file read in the browser. */
@Component({
  selector: 'fs-spec-step',
  imports: [ApiErrorNotice, FileDrop, FormField, MatButton, MatError, MatFormField, MatInput, MatLabel, MatProgressBar],
  templateUrl: './spec-step.html',
  styleUrl: './spec-step.scss'
})
export class SpecStep {
  private readonly browser = inject(SpecBrowser);
  private readonly sourceModel = signal<SpecSource>({ url: '' });

  protected readonly isLoading = this.browser.isLoading;
  protected readonly error = this.browser.error;
  protected readonly fileError = signal<string | undefined>(undefined);

  protected readonly sourceForm = form(this.sourceModel, specSourceSchema);

  /** Loads the URL once it validates; invalid input only reveals its errors. */
  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.sourceForm().markAsTouched();

    const isInvalid = this.sourceForm().invalid();

    if (isInvalid) return;

    this.browser.loadUrl(this.sourceModel().url.trim());
  }

  protected async loadFile(file: File): Promise<void> {
    const text = await file.text();
    const parse = parseSpecDocument(text, file.name);

    if (parse.kind === 'error') {
      this.fileError.set(parse.message);

      return;
    }

    this.fileError.set(undefined);
    this.browser.loadDocument(parse.document);
  }
}
