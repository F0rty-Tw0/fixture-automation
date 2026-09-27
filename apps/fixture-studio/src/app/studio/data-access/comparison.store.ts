import { Service, inject, resource, signal } from '@angular/core';
import type { ResourceRef, Signal, WritableSignal } from '@angular/core';

import type { DiffResult } from '@fixture-automation/fixture-studio-api/contract';

import { STUDIO_ENGINE } from './studio-engine.token.ts';
import { DEFAULT_COMPARE_FORM } from '../common/comparison.const.ts';
import type { CompareForm, DiffRequest, ExistingFixture } from '../common/comparison.type.ts';
import type { EngineCall } from '../common/engine.type.ts';

/** One endpoint tab's compare state: the existing fixture read locally, and its diff against the schema. */
@Service({ autoProvided: false })
export class ComparisonStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private readonly request = signal<DiffRequest | undefined>(undefined);

  public readonly form: WritableSignal<CompareForm> = signal(DEFAULT_COMPARE_FORM);
  public readonly existing = signal<ExistingFixture | undefined>(undefined);
  public readonly sourceError = signal<string | undefined>(undefined);

  /** The file being parsed; a `.ts` file first loads the TypeScript compiler, which can take seconds. */
  public readonly readingName = signal<string | undefined>(undefined);

  /** The request behind the current diff: what AI fill and merge must use, not the live form. */
  public readonly compared: Signal<DiffRequest | undefined> = this.request.asReadonly();

  public readonly diff: ResourceRef<DiffResult | undefined> = resource({
    params: () => this.request(),
    loader: async ({ params, abortSignal }): Promise<DiffResult> => {
      const call: EngineCall = { signal: abortSignal };

      return this.engine.diff(params.specId, params.body, call);
    }
  });

  /** A newly read fixture replaces the old one and drops its diff. */
  public setExisting(existing: ExistingFixture): void {
    this.readingName.set(undefined);
    this.existing.set(existing);
    this.sourceError.set(undefined);
    this.request.set(undefined);
  }

  public startReading(name: string): void {
    this.readingName.set(name);
  }

  public rejectSource(message: string): void {
    this.readingName.set(undefined);
    this.sourceError.set(message);
  }

  public compare(request: DiffRequest): void {
    this.request.set(request);
  }
}
