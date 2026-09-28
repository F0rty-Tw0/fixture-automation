import { Service, computed, inject } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';

import type { ApiErrorBody, FixtureFormat, GenerateBody } from '@fixture-automation/fixture-studio-api/contract';

import type { FixtureView, GenerateOptions, GenerateRequest } from '../common/studio.type.ts';
import { GenerationStore } from '../data-access/generation.store.ts';
import { SelectionStore } from '../data-access/selection.store.ts';
import { SpecStore } from '../data-access/spec.store.ts';
import { toApiError } from '../utils/api-error.util.ts';
import { fixtureFormats, fixtureViews } from '../utils/fixture-document.util.ts';
import { selectedEndpointIds } from '../utils/selection.util.ts';

/** Turns the selected endpoints and chosen formats into generated fixtures. */
@Service()
export class FixtureGeneration {
  private readonly specStore = inject(SpecStore);
  private readonly selection = inject(SelectionStore);
  private readonly generation = inject(GenerationStore);

  public readonly options: WritableSignal<GenerateOptions> = this.generation.options;
  public readonly formats: Signal<FixtureFormat[]> = computed(() => fixtureFormats(this.options()));
  public readonly isGenerating: Signal<boolean> = this.generation.result.isLoading;
  public readonly error: Signal<ApiErrorBody | undefined> = computed(() => toApiError(this.generation.result.error()));

  public readonly views: Signal<FixtureView[]> = computed(() => {
    if (!this.generation.result.hasValue()) return [];

    return fixtureViews(this.generation.result.value().fixtures);
  });

  public readonly canGenerate: Signal<boolean> = computed(() => {
    const hasSpec = this.specStore.loadedSpec() !== undefined;
    const hasSelection = this.selection.selectedIds().size > 0;
    const hasFormat = this.formats().length > 0;

    return hasSpec && hasSelection && hasFormat;
  });

  /** Posts the selection; does nothing while `canGenerate` is false. */
  public generate(): void {
    const spec = this.specStore.loadedSpec();
    const canGenerate = this.canGenerate();

    if (spec === undefined) return;

    if (!canGenerate) return;

    const endpointIds = selectedEndpointIds(spec.endpoints, this.selection.selectedIds());
    const body: GenerateBody = { endpointIds, formats: this.formats(), requiredOnly: this.options().requiredOnly };
    const request: GenerateRequest = { specId: spec.specId, body };

    this.generation.generate(request);
  }
}
