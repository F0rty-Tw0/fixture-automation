import { Component, computed, input } from '@angular/core';
import type { Signal } from '@angular/core';

import type { BrokenValue } from '@fixture-automation/fixture-studio-api/contract';

import { valuePreview } from '../../utils/value-preview.util.ts';

/** A value longer than this is cut in the list; the row's title still shows it up to the same cut. */
const PREVIEW_LIMIT = 120;

type BrokenRow = {
  readonly path: string;
  readonly preview: string;
  readonly reason: string;
};

const rowOf = (broken: BrokenValue): BrokenRow => {
  const row: BrokenRow = { path: broken.path, preview: valuePreview(broken.value, PREVIEW_LIMIT), reason: broken.reason };

  return row;
};

/** Present values the schema rejects or that are sampler placeholders: path, the value found, and why it is broken. */
@Component({
  selector: 'fs-broken-value-list',
  templateUrl: './broken-value-list.html',
  styleUrl: './broken-value-list.scss'
})
export class BrokenValueList {
  public readonly values = input.required<BrokenValue[]>();

  protected readonly rows: Signal<BrokenRow[]> = computed(() => this.values().map(rowOf));
}
