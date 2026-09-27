import { Service, computed, inject, resource, signal } from '@angular/core';
import type { ResourceRef, Signal } from '@angular/core';

import type { LoadSpecBody, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';

import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { EngineCall } from '../common/engine.type.ts';
import { specSourceLabel } from '../utils/spec-source.util.ts';

/** The loaded spec; the engine is called when `load` sets a source and stays idle before that. */
@Service()
export class SpecStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private readonly source = signal<LoadSpecBody | undefined>(undefined);

  public readonly spec: ResourceRef<LoadedSpec | undefined> = resource({
    params: () => this.source(),
    loader: async ({ params, abortSignal }): Promise<LoadedSpec> => {
      const call: EngineCall = { signal: abortSignal };

      return this.engine.loadSpec(params, call);
    }
  });

  /** Where the current spec comes from: a URL's host or "a local file". */
  public readonly sourceLabel: Signal<string | undefined> = computed(() => specSourceLabel(this.source()));

  /** The last successfully loaded spec; `undefined` while idle, loading, or failed. */
  public readonly loadedSpec: Signal<LoadedSpec | undefined> = computed(() => {
    if (!this.spec.hasValue()) return undefined;

    return this.spec.value();
  });

  public load(body: LoadSpecBody): void {
    this.source.set(body);
  }
}
