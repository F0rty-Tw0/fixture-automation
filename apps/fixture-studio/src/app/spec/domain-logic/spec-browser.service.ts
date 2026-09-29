import { Service, computed, inject } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';

import type { ApiErrorBody, Endpoint, LoadSpecBody, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';

import { toApiError } from '../../shared/api-error/utils/api-error.util.ts';
import { DEFAULT_ENDPOINT_FILTER } from '../common/spec.const.ts';
import type { EndpointFilter, EndpointGroup } from '../common/spec.type.ts';
import { SelectionStore } from '../data-access/selection.store.ts';
import { SpecStore } from '../data-access/spec.store.ts';
import { endpointMethods, endpointTags, filterEndpoints, groupByTag, isSupported } from '../utils/endpoint-filter.util.ts';

const endpointIdOf = (endpoint: Endpoint): string => endpoint.id;

/** Loads a spec and browses its endpoints: filtering, grouping, and selection. */
@Service()
export class SpecBrowser {
  private readonly specStore = inject(SpecStore);
  private readonly selection = inject(SelectionStore);

  private readonly selectableVisibleIds = computed(() => {
    const supported = this.visibleEndpoints().filter(isSupported);

    return supported.map(endpointIdOf);
  });

  public readonly loadedSpec: Signal<LoadedSpec | undefined> = this.specStore.loadedSpec;
  public readonly sourceLabel: Signal<string | undefined> = this.specStore.sourceLabel;
  public readonly isLoading: Signal<boolean> = this.specStore.spec.isLoading;
  public readonly error: Signal<ApiErrorBody | undefined> = computed(() => toApiError(this.specStore.spec.error()));
  public readonly endpoints: Signal<Endpoint[]> = computed(() => this.loadedSpec()?.endpoints ?? []);

  public readonly tags: Signal<string[]> = computed(() => endpointTags(this.endpoints()));
  public readonly methods: Signal<string[]> = computed(() => endpointMethods(this.endpoints()));
  public readonly filter: WritableSignal<EndpointFilter> = this.selection.filter;
  public readonly visibleEndpoints: Signal<Endpoint[]> = computed(() => filterEndpoints(this.endpoints(), this.filter()));
  public readonly visibleGroups: Signal<EndpointGroup[]> = computed(() => groupByTag(this.visibleEndpoints()));
  public readonly selectedIds: Signal<Set<string>> = this.selection.selectedIds.asReadonly();
  public readonly selectedCount: Signal<number> = computed(() => this.selectedIds().size);

  /** True when every supported visible endpoint is selected; false when none is selectable. */
  public readonly allVisibleSelected: Signal<boolean> = computed(() => {
    const ids = this.selectableVisibleIds();
    const selected = this.selectedIds();

    if (ids.length === 0) return false;

    return ids.every((id) => selected.has(id));
  });

  public loadUrl(url: string): void {
    const body: LoadSpecBody = { url };

    this.specStore.load(body);
  }

  public loadDocument(document: Record<string, unknown>): void {
    const body: LoadSpecBody = { document };

    this.specStore.load(body);
  }

  public resetFilter(): void {
    this.filter.set(DEFAULT_ENDPOINT_FILTER);
  }

  public toggle(id: string): void {
    this.selection.toggle(id);
  }

  /** Selects every supported visible endpoint, or clears them when all are already selected. */
  public toggleAllVisible(): void {
    const ids = this.selectableVisibleIds();
    const isSelecting = !this.allVisibleSelected();

    this.selection.setSelected(ids, isSelecting);
  }
}
