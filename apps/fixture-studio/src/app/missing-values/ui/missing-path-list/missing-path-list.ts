import { Component, computed, input } from '@angular/core';
import type { Signal } from '@angular/core';

import type { PathGroup } from '../../common/missing-values.type.ts';
import { groupPathsByRoot } from '../../utils/path-group.util.ts';

/** Up to this many paths every group starts open; past it the groups start folded, so only their counts show. */
const OPEN_GROUPS_LIMIT = 20;

/**
 * Dotted fixture paths under a heading, with a count, grouped by their first segment below the envelope. Each group
 * folds, and the list scrolls inside itself; an empty list means the fixture is complete.
 */
@Component({
  selector: 'fs-missing-path-list',
  templateUrl: './missing-path-list.html',
  styleUrl: './missing-path-list.scss'
})
export class MissingPathList {
  public readonly paths = input.required<string[]>();
  public readonly heading = input('Missing paths');
  /** The envelope property the paths start with, if any; groups start below it. */
  public readonly envelope = input<string | undefined>(undefined);

  protected readonly groups: Signal<PathGroup[]> = computed(() => groupPathsByRoot(this.paths(), this.envelope()));

  protected readonly isOpen: Signal<boolean> = computed(() => this.paths().length <= OPEN_GROUPS_LIMIT);
}
