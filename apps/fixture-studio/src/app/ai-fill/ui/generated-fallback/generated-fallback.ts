import { Component, input } from '@angular/core';

import type { FixtureDocument, HashedExport, LineHighlight } from '../../../shared/document-view/common/document-view.type.ts';
import { DocumentView } from '../../../shared/document-view/ui/document-view/document-view.ts';
import { NoticeList } from '../../../shared/notice/ui/notice-list/notice-list.ts';

/** The schema-complete fixture offered when an AI fill fails, so the user still leaves with every value filled. */
@Component({
  selector: 'fs-generated-fallback',
  imports: [DocumentView, NoticeList],
  templateUrl: './generated-fallback.html',
  styleUrl: './generated-fallback.scss',
  host: { role: 'region', 'aria-label': 'Generated fallback' }
})
export class GeneratedFallback {
  public readonly document = input.required<FixtureDocument>();
  public readonly highlights = input<LineHighlight[]>([]);
  public readonly original = input<string | undefined>(undefined);
  public readonly originalHighlights = input<LineHighlight[]>([]);
  /** Lets the fixture be exported under the CLI merge's hashed file name. */
  public readonly hashedExport = input<HashedExport | undefined>(undefined);
  /** The compare's warnings: parts of the diff fell back, so the schema may not have completed every value. */
  public readonly warnings = input<string[]>([]);
}
