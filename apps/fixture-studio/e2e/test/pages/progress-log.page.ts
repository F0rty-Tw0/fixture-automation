import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { aiFillPanel } from './ai-fill-panel.page.ts';
import { gapBelow, hiddenOverflow } from '../utils/scroll.spec.util.ts';

const progressLog = (page: Page): Locator => aiFillPanel(page).getByRole('log', { name: 'AI progress' });

/** One entry per status line or per run of model output; entries have no role, so they are read by their stream attribute. */
const logEntries = (page: Page): Locator => progressLog(page).locator('[data-stream]');

/** The log's entries in order, each compared with whitespace collapsed. */
export const expectLogEntries = async (page: Page, texts: string[]): Promise<void> => {
  const entries = logEntries(page);

  await test.step(`THEN the log holds ${texts.length} entries`, async (): Promise<void> => expect(entries).toHaveText(texts), {
    box: true
  });
};

/** The log is a capped box: its lines scroll inside it, and it stays scrolled to the newest one. */
export const expectLogFollowsNewest = async (page: Page): Promise<void> => {
  const log = progressLog(page);
  const overflow = async (): Promise<number> => hiddenOverflow(log);
  const below = async (): Promise<number> => gapBelow(log);

  await test.step('THEN the log scrolls inside its box, at its newest line', async (): Promise<void> => {
    await expect.poll(overflow).toBeGreaterThan(0);
    await expect.poll(below).toBeLessThanOrEqual(1);
  }, { box: true });
};
