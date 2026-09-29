import { Service, inject, resource, signal } from '@angular/core';
import type { ResourceRef, Signal, WritableSignal } from '@angular/core';

import type { DiffResult, EnvelopeBody, EnvelopeResult } from '@fixture-automation/fixture-studio-api/contract';

import type { EngineCall } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { DEFAULT_COMPARE_FORM, NO_ENVELOPE } from '../common/comparison.const.ts';
import type { CompareForm, DiffRequest, ExistingFixture } from '../common/comparison.type.ts';

/** One endpoint tab's compare state: the existing fixture read locally, and its diff against the schema. */
@Service({ autoProvided: false })
export class ComparisonStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private readonly request = signal<DiffRequest | undefined>(undefined);
  private detecting: AbortController | undefined;

  public readonly form: WritableSignal<CompareForm> = signal(DEFAULT_COMPARE_FORM);
  public readonly existing = signal<ExistingFixture | undefined>(undefined);
  public readonly sourceError = signal<string | undefined>(undefined);

  /** Top-level keys of the fixture that could hold the payload, best match first; empty until the API names them. */
  public readonly envelopes = signal<string[]>([]);

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

  /** A newly read fixture replaces the old one and drops its diff and envelope candidates. */
  public setExisting(existing: ExistingFixture): void {
    this.readingName.set(undefined);
    this.existing.set(existing);
    this.sourceError.set(undefined);
    this.envelopes.set([]);
    this.request.set(undefined);
  }

  /**
   * Asks which top-level key holds the payload; a newer ask cancels this one. Detection only saves the user a choice,
   * so a failure answers "no candidates" and the fixture is compared as the payload.
   */
  public async detectEnvelope(specId: string, body: EnvelopeBody): Promise<EnvelopeResult> {
    this.detecting?.abort();

    const detecting = new AbortController();
    const call: EngineCall = { signal: detecting.signal };

    this.detecting = detecting;

    try {
      return await this.engine.envelope(specId, body, call);
    } catch {
      return NO_ENVELOPE;
    }
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
