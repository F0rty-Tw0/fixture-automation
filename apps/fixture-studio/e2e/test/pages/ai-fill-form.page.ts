import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { aiFillPanel } from './ai-fill-panel.page.ts';

export const typeExtraPrompt = async (page: Page, scenario: string): Promise<void> => {
  await aiFillPanel(page).getByRole('textbox', { name: 'Extra prompt (scenario)' }).fill(scenario);
};

export const expectFillEnabled = async (page: Page): Promise<void> => {
  const fill = aiFillPanel(page).getByRole('button', { name: 'Fill missing values' });

  await test.step('THEN Fill missing values is enabled', async (): Promise<void> => expect(fill).toBeEnabled(), { box: true });
};

/** Cancel only shows while a fill runs. */
export const expectNotRunning = async (page: Page): Promise<void> => {
  const cancel = aiFillPanel(page).getByRole('button', { name: 'Cancel' });

  await test.step('THEN no fill is running', async (): Promise<void> => expect(cancel).toHaveCount(0), { box: true });
};

export const expectNoDownloadOffered = async (page: Page): Promise<void> => {
  const download = aiFillPanel(page).getByRole('button', { name: 'Download model' });

  await test.step('THEN no model download is offered', async (): Promise<void> => expect(download).toHaveCount(0), { box: true });
};

export const expectChromeUnavailable = async (page: Page): Promise<void> => {
  const note = aiFillPanel(page).getByText("Chrome AI can't run in this browser, so the local CLI fills instead.");

  await test.step('THEN it says Chrome AI cannot run here and the CLI fills', async (): Promise<void> => expect(note).toBeVisible(), {
    box: true
  });
};
