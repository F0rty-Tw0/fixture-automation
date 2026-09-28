import { Component, input } from '@angular/core';

/** An HTTP verb in its conventional color; `data-method` drives the hue. */
@Component({
  selector: 'fs-method-badge',
  template: `{{ method() }}`,
  styleUrl: './method-badge.scss',
  host: { '[attr.data-method]': 'method()' }
})
export class MethodBadge {
  public readonly method = input.required<string>();
}
