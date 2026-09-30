import { Component, input, output } from '@angular/core';
import { MatCheckbox } from '@angular/material/checkbox';

import { MethodBadge } from '../../../shared/method-badge/ui/method-badge/method-badge.ts';
import type { EndpointGroup } from '../../../spec/common/spec.type.ts';

/**
 * Endpoints grouped by tag, one checkbox per row. Operations the pipeline cannot
 * sample stay visible but disabled, with the API's reason beside them.
 */
@Component({
  selector: 'fs-endpoint-list',
  imports: [MatCheckbox, MethodBadge],
  templateUrl: './endpoint-list.html',
  styleUrl: './endpoint-list.scss'
})
export class EndpointList {
  public readonly groups = input.required<EndpointGroup[]>();
  public readonly selectedIds = input.required<ReadonlySet<string>>();

  public readonly toggled = output<string>();
}
