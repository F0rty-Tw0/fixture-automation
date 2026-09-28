import { Component, input } from '@angular/core';

import type { FixtureDocument } from '../../common/studio.type.ts';
import { CodeView } from '../code-view/code-view.ts';
import { CopyExportBar } from '../copy-export-bar/copy-export-bar.ts';

/** One document: file bar with copy/export, then the editor, loaded lazily together with CodeMirror. */
@Component({
  selector: 'fs-document-view',
  imports: [CodeView, CopyExportBar],
  templateUrl: './document-view.html',
  styleUrl: './document-view.scss'
})
export class DocumentView {
  public readonly document = input.required<FixtureDocument>();
  /** When set, the editor shows it beside `document` as a side-by-side diff. */
  public readonly original = input<string | undefined>(undefined);
}
