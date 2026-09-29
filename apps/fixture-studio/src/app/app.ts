import { Component } from '@angular/core';

import { StudioPage } from './studio-page/feature/studio-page/studio-page.ts';

@Component({
  selector: 'fs-root',
  imports: [StudioPage],
  template: `<fs-studio-page />`
})
export class App {}
