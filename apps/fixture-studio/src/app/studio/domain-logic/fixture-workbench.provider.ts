import type { Provider } from '@angular/core';

import { FillProgress } from './fill-progress.service.ts';
import { FixtureAiFill } from './fixture-ai-fill.service.ts';
import { FixtureComparison } from './fixture-comparison.service.ts';
import { OnDeviceAi } from './on-device-ai.service.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';

/** Per generated endpoint: its compare, missing-values and AI fill steps get their own state. */
export const provideFixtureWorkbench = (): Provider[] => {
  return [ComparisonStore, AiFillStore, FixtureComparison, FillProgress, OnDeviceAi, FixtureAiFill];
};
