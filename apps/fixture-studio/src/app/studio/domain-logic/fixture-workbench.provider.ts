import type { Provider } from '@angular/core';

import { FixtureAiFill } from './fixture-ai-fill.service.ts';
import { FixtureComparison } from './fixture-comparison.service.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';

/** Per endpoint tab: each workbench gets its own compare and AI fill state. */
export const provideFixtureWorkbench = (): Provider[] => {
  return [ComparisonStore, AiFillStore, FixtureComparison, FixtureAiFill];
};
