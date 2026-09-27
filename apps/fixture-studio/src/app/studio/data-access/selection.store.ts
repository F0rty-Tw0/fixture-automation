import { Service, inject, linkedSignal } from '@angular/core';
import type { WritableSignal } from '@angular/core';

import { SpecStore } from './spec.store.ts';
import { DEFAULT_ENDPOINT_FILTER } from '../common/studio.const.ts';
import type { EndpointFilter } from '../common/studio.type.ts';
import { toggledSelection, withSelection } from '../utils/selection.util.ts';

/** Filter and selection over the loaded endpoints; both reset whenever another spec loads. */
@Service()
export class SelectionStore {
  private readonly specStore = inject(SpecStore);

  public readonly filter: WritableSignal<EndpointFilter> = linkedSignal({
    source: this.specStore.loadedSpec,
    computation: (): EndpointFilter => DEFAULT_ENDPOINT_FILTER
  });

  public readonly selectedIds: WritableSignal<Set<string>> = linkedSignal({
    source: this.specStore.loadedSpec,
    computation: (): Set<string> => new Set<string>()
  });

  public toggle(id: string): void {
    this.selectedIds.update((selected) => toggledSelection(selected, id));
  }

  public setSelected(ids: string[], isSelected: boolean): void {
    this.selectedIds.update((selected) => withSelection(selected, ids, isSelected));
  }
}
