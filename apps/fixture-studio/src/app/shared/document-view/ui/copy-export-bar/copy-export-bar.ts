import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import type { ResourceRef, Signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { FixtureNameQuery } from '@fixture-automation/fixture-studio-api/contract';

import type { ExportNaming, HashedExport } from '../../common/document-view.type.ts';
import { formatSize, mimeTypeOf } from '../../utils/file-size.util.ts';

const SNACK_DURATION_MS = 2400;

/** An OpenAPI path parameter left in a URL, e.g. `{id}`. */
const PATH_PLACEHOLDER = /\{[^{}]*\}/gu;

/** Any brace, so a half-edited parameter (`{id`) still counts as template. */
const TEMPLATE_BRACE = /[{}]/u;

/** The hint for a URL still holding template braces: both spellings are valid, for different CLI flows. */
const templateHint = (url: string): string => {
  const placeholders = url.match(PATH_PLACEHOLDER) ?? [];
  const placeholderList = placeholders.join(', ');
  const parts = placeholders.length > 0 ? placeholderList : 'the braces';

  return `Kept as the template: matches the wizard's route target. Replace ${parts} to match a merge run with a real URL.`;
};

type HashedNameRequest = {
  readonly naming: ExportNaming;
  readonly query: FixtureNameQuery;
};

/**
 * File name, size, and the two ways out of the studio: clipboard and download. Given a `hashedExport`, it also offers
 * the CLI merge's hashed file name, for a concrete URL the user makes from the endpoint's path template.
 */
@Component({
  selector: 'fs-copy-export-bar',
  imports: [MatButton, MatFormField, MatInput, MatLabel, MatSlideToggle],
  templateUrl: './copy-export-bar.html',
  styleUrl: './copy-export-bar.scss'
})
export class CopyExportBar {
  public readonly fileName = input.required<string>();
  public readonly content = input.required<string>();
  /** When set, a toggle names the export like the CLI merge instead of `fileName`. */
  public readonly hashedExport = input<HashedExport | undefined>(undefined);

  private readonly document = inject(DOCUMENT);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly size = computed(() => formatSize(this.content()));
  protected readonly isHashed = signal(false);
  protected readonly url = linkedSignal(() => this.hashedExport()?.path ?? '');
  protected readonly subdirectory = computed(() => this.hashedExport()?.naming.subdirectory() ?? '');

  private readonly isHashing = computed(() => this.hashedExport() !== undefined && this.isHashed());

  private readonly isUrlEmpty = computed(() => this.url().trim() === '');

  private readonly hashedNameRequest: Signal<HashedNameRequest | undefined> = computed(() => {
    const hashedExport = this.hashedExport();

    if (hashedExport === undefined || !this.isHashed()) return undefined;

    if (this.isUrlEmpty()) return undefined;

    const query: FixtureNameQuery = { method: hashedExport.method, url: this.url(), subdirectory: this.subdirectory() };
    const request: HashedNameRequest = { naming: hashedExport.naming, query };

    return request;
  });

  private readonly hashedName: ResourceRef<string | undefined> = resource({
    params: () => this.hashedNameRequest(),
    loader: async ({ params, abortSignal }): Promise<string> => params.naming.fileName(params.query, abortSignal)
  });

  /** The name Export writes; `undefined` while the hashed name is blocked, loading, or failed. */
  private readonly exportFileName: Signal<string | undefined> = computed(() => {
    if (!this.isHashing()) return this.fileName();

    const hasName = this.hashedName.hasValue();
    const isLoading = this.hashedName.isLoading();

    if (!hasName || isLoading) return undefined;

    return this.hashedName.value();
  });

  protected readonly shownFileName = computed(() => this.exportFileName() ?? '…');
  protected readonly canExport = computed(() => this.exportFileName() !== undefined);

  /** Why Export is blocked (no URL, API error), or which CLI flow a template URL matches. */
  protected readonly hashingNote: Signal<string | undefined> = computed(() => {
    if (!this.isHashing()) return undefined;

    const error = this.hashedName.error();
    const url = this.url();
    const isTemplate = TEMPLATE_BRACE.test(url);

    if (error !== undefined) return `No hashed name: ${error.message}`;

    if (this.isUrlEmpty()) return 'Enter the endpoint URL to export under the hashed name.';

    if (isTemplate) return templateHint(url);

    return undefined;
  });

  protected rememberSubdirectory(subdirectory: string): void {
    this.hashedExport()?.naming.rememberSubdirectory(subdirectory);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.content());
      const copiedName = this.exportFileName() ?? this.fileName();

      this.snackBar.open(`Copied ${copiedName}`, undefined, { duration: SNACK_DURATION_MS });
    } catch {
      this.snackBar.open('The browser blocked clipboard access. Use Export instead.', 'Dismiss');
    }
  }

  protected download(): void {
    const fileName = this.exportFileName();

    if (fileName === undefined) return;

    const blob = new Blob([this.content()], { type: mimeTypeOf(fileName) });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${fileName}`, undefined, { duration: SNACK_DURATION_MS });
  }
}
