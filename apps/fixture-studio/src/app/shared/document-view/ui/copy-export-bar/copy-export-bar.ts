import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { formatSize, mimeTypeOf } from '../../utils/file-size.util.ts';

const SNACK_DURATION_MS = 2400;

/** File name, size, and the two ways out of the studio: clipboard and download. */
@Component({
  selector: 'fs-copy-export-bar',
  imports: [MatButton],
  templateUrl: './copy-export-bar.html',
  styleUrl: './copy-export-bar.scss'
})
export class CopyExportBar {
  public readonly fileName = input.required<string>();
  public readonly content = input.required<string>();

  private readonly document = inject(DOCUMENT);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly size = computed(() => formatSize(this.content()));

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.content());
      this.snackBar.open(`Copied ${this.fileName()}`, undefined, { duration: SNACK_DURATION_MS });
    } catch {
      this.snackBar.open('The browser blocked clipboard access. Use Export instead.', 'Dismiss');
    }
  }

  protected download(): void {
    const blob = new Blob([this.content()], { type: mimeTypeOf(this.fileName()) });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');

    anchor.href = url;
    anchor.download = this.fileName();
    anchor.click();
    URL.revokeObjectURL(url);
    this.snackBar.open(`Exported ${this.fileName()}`, undefined, { duration: SNACK_DURATION_MS });
  }
}
