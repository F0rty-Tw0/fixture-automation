import { Component, input } from '@angular/core';

import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';

/** Shows an API failure as its two CLI-style lines: what went wrong, and how to fix it. */
@Component({
  selector: 'fs-api-error-notice',
  templateUrl: './api-error-notice.html',
  styleUrl: './api-error-notice.scss',
  host: { role: 'alert', class: 'notice' }
})
export class ApiErrorNotice {
  public readonly error = input.required<ApiErrorBody>();
}
