import { Component, input } from '@angular/core';

/** A non-blocking notice: a heading and a list of plain-language lines, announced politely rather than as an alert. */
@Component({
  selector: 'fs-notice-list',
  templateUrl: './notice-list.html',
  styleUrl: './notice-list.scss',
  host: { role: 'status', '[attr.aria-label]': 'heading()' }
})
export class NoticeList {
  public readonly heading = input.required<string>();
  public readonly lines = input.required<string[]>();
}
