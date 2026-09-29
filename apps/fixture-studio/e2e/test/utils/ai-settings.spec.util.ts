import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { AI_OPT_IN_STORAGE_KEY } from '../../../src/app/workbench/common/ai-fill.const.ts';

/** Runs in the page before the app: the stored answer of a user who ticked "Use on-device Chrome AI" on an earlier visit. */
const storeOptIn = (key: string): void => {
  globalThis.localStorage.setItem(key, 'true');
};

export const optInToChromeAi = async (page: Page): Promise<void> => {
  await page.addInitScript(storeOptIn, AI_OPT_IN_STORAGE_KEY);
};

const readOptIn = (key: string): string | null => globalThis.localStorage.getItem(key);

/** The stored opt-in is still on: hiding the checkbox for a large fixture must not forget the user's choice. */
export const expectChromeAiOptInStored = async (page: Page): Promise<void> => {
  const stored = await page.evaluate(readOptIn, AI_OPT_IN_STORAGE_KEY);

  expect(stored).toBe('true');
};
