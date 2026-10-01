import { Service, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import type { FixtureNameQuery } from '@fixture-automation/fixture-studio-api/contract';

import type { EngineCall } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { EXPORT_SUBDIRECTORY_STORAGE_KEY } from '../common/ai-fill.const.ts';

/** Storage can be missing or throw (private mode, blocked site data); the subdirectory then lives for the session only. */
const readSubdirectory = (): string => {
  try {
    return globalThis.localStorage.getItem(EXPORT_SUBDIRECTORY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const writeSubdirectory = (subdirectory: string): void => {
  try {
    globalThis.localStorage.setItem(EXPORT_SUBDIRECTORY_STORAGE_KEY, subdirectory);
  } catch {
    // The in-memory value still applies for this session.
  }
};

/** The hashed export's subdirectory, remembered per browser, and the engine's lookup of the CLI merge's file name. */
@Service()
export class ExportNamingStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private readonly remembered = signal(readSubdirectory());

  public readonly subdirectory: Signal<string> = this.remembered.asReadonly();

  public rememberSubdirectory(subdirectory: string): void {
    this.remembered.set(subdirectory);
    writeSubdirectory(subdirectory);
  }

  public async fileName(query: FixtureNameQuery, abortSignal: AbortSignal): Promise<string> {
    const call: EngineCall = { signal: abortSignal };
    const result = await this.engine.fixtureName(query, call);

    return result.fileName;
  }
}
