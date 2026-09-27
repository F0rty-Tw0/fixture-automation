import { Component, ElementRef, afterRenderEffect, inject, input } from '@angular/core';

import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';

/** Live output of an AI run, kept scrolled to the newest line. */
@Component({
  selector: 'fs-progress-log',
  templateUrl: './progress-log.html',
  styleUrl: './progress-log.scss',
  host: { 'aria-label': 'AI progress', 'aria-live': 'polite', role: 'log' }
})
export class ProgressLog {
  public readonly lines = input.required<AiFillProgressEvent[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  public constructor() {
    afterRenderEffect((): void => {
      this.lines();

      const element = this.host.nativeElement;

      element.scrollTop = element.scrollHeight;
    });
  }
}
