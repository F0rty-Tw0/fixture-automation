import { Service, inject } from '@angular/core';
import type { Signal } from '@angular/core';

import type { FixtureNameQuery } from '@fixture-automation/fixture-studio-api/contract';

import type { ExportNaming } from '../../shared/document-view/common/document-view.type.ts';
import { ExportNamingStore } from '../data-access/export-naming.store.ts';

/** Names a final fixture's export like the CLI merge, with the subdirectory this browser used last. */
@Service()
export class FixtureExportNaming implements ExportNaming {
  private readonly store = inject(ExportNamingStore);

  public readonly subdirectory: Signal<string> = this.store.subdirectory;

  public rememberSubdirectory(subdirectory: string): void {
    this.store.rememberSubdirectory(subdirectory);
  }

  public async fileName(query: FixtureNameQuery, abortSignal: AbortSignal): Promise<string> {
    return this.store.fileName(query, abortSignal);
  }
}
