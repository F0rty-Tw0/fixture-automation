import { Component, input } from '@angular/core';

/** Dotted fixture paths under a heading, with a count; an empty list means the fixture is complete. */
@Component({
  selector: 'fs-missing-path-list',
  templateUrl: './missing-path-list.html',
  styleUrl: './missing-path-list.scss'
})
export class MissingPathList {
  public readonly paths = input.required<string[]>();
  public readonly heading = input('Missing paths');
}
