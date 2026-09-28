import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { aiFillPanel } from './ai-fill-panel.page.ts';

export const typeExtraPrompt = async (page: Page, scenario: string): Promise<void> => {
  await aiFillPanel(page).getByRole('textbox', { name: 'Extra prompt (scenario)' }).fill(scenario);
};

export const expectFillEnabled = async (page: Page): Promise<void> => {
  const fill = aiFillPanel(page).getByRole('button', { name: 'Fill missing values' });

  await expect(fill).toBeEnabled();
};

/** Cancel only shows while a fill runs. */
export const expectNotRunning = async (page: Page): Promise<void> => {
  const cancel = aiFillPanel(page).getByRole('button', { name: 'Cancel' });

  await expect(cancel).toHaveCount(0);
};

export const expectNoDownloadOffered = async (page: Page): Promise<void> => {
  const download = aiFillPanel(page).getByRole('button', { name: 'Download model' });

  await expect(download).toHaveCount(0);
};

export const expectChromeUnavailable = async (page: Page): Promise<void> => {
  const note = aiFillPanel(page).getByText("Chrome AI can't run in this browser, so the local CLI fills instead.");

  await expect(note).toBeVisible();
};
