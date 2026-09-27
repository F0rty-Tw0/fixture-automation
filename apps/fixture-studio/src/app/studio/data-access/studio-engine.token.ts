import { InjectionToken } from '@angular/core';

import type { StudioEngine } from '../common/engine.type.ts';

/** The `StudioEngine` port; `app.config` binds it to an implementation. */
export const STUDIO_ENGINE = new InjectionToken<StudioEngine>('StudioEngine');
