import { bootstrapApplication } from '@angular/platform-browser';

import { APP_CONFIG } from './app/app.config.ts';
import { App } from './app/app.ts';

bootstrapApplication(App, APP_CONFIG).catch((error: unknown): void => {
  console.error(error);
});
