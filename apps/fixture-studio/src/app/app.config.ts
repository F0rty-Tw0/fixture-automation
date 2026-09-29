import { provideHttpClient } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';

import { provideHttpStudioEngine } from './shared/studio-engine/domain-logic/studio-engine.provider.ts';

export const APP_CONFIG: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpStudioEngine()]
};
