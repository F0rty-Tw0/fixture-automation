import type { Provider } from '@angular/core';

import { STUDIO_ENGINE } from '../common/studio-engine.token.ts';
import { HttpStudioEngine } from '../data-access/http-studio.engine.ts';

/** Backs the `StudioEngine` port with the Fixture Studio HTTP API. */
export const provideHttpStudioEngine = (): Provider => {
  const provider: Provider = { provide: STUDIO_ENGINE, useClass: HttpStudioEngine };

  return provider;
};
