import type { Provider } from '@angular/core';

import { HttpStudioEngine } from '../data-access/http-studio.engine.ts';
import { STUDIO_ENGINE } from '../data-access/studio-engine.token.ts';

/** Backs the `StudioEngine` port with the Fixture Studio HTTP API. */
export const provideHttpStudioEngine = (): Provider => {
  const provider: Provider = { provide: STUDIO_ENGINE, useClass: HttpStudioEngine };

  return provider;
};
