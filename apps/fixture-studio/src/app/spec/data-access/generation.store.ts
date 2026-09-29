import { Service, inject, linkedSignal, resource, signal } from '@angular/core';
import type { ResourceRef, WritableSignal } from '@angular/core';

import type { GenerateResult, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';

import { SpecStore } from './spec.store.ts';
import type { EngineCall } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { DEFAULT_GENERATE_OPTIONS } from '../common/generation.const.ts';
import type { GenerateOptions, GenerateRequest } from '../common/generation.type.ts';

/** Generation options and result; a newly loaded spec drops the previous result. */
@Service()
export class GenerationStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private readonly specStore = inject(SpecStore);

  private readonly request = linkedSignal<LoadedSpec | undefined, GenerateRequest | undefined>({
    source: this.specStore.loadedSpec,
    computation: (): undefined => undefined
  });

  public readonly options: WritableSignal<GenerateOptions> = signal(DEFAULT_GENERATE_OPTIONS);

  public readonly result: ResourceRef<GenerateResult | undefined> = resource({
    params: () => this.request(),
    loader: async ({ params, abortSignal }): Promise<GenerateResult> => {
      const call: EngineCall = { signal: abortSignal };

      return this.engine.generate(params.specId, params.body, call);
    }
  });

  public generate(request: GenerateRequest): void {
    this.request.set(request);
  }
}
