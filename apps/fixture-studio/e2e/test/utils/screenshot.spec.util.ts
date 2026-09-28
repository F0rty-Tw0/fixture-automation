import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { SCREENSHOT_DIR } from '../common/playwright.const.ts';

const documentHeight = (): number => document.documentElement.scrollHeight;

const scrollToTop = (): void => window.scrollTo(0, 0);

/**
 * Saves the whole page as `screenshots/<variant>/<name>.png` for the design pass. Chromium's `fullPage`
 * capture intermittently leaves everything below the first viewport unpainted on tall narrow pages, so the
 * viewport is grown to the document height for a plain capture, then restored. A click below the fold leaves
 * the page scrolled, and the editor grows with the viewport, so the page is sent back to the top before capture.
 */
export const capture = async (page: Page, variant: string, name: string): Promise<void> => {
  const path = join(SCREENSHOT_DIR, variant, `${name}.png`);
  const viewport = page.viewportSize();

  if (viewport === null) throw new Error('The screenshot project needs a fixed viewport.');

  const height = await page.evaluate(documentHeight);
  const fullViewport = { width: viewport.width, height: Math.max(height, viewport.height) };

  await page.setViewportSize(fullViewport);
  await page.evaluate(scrollToTop);
  await page.screenshot({ animations: 'disabled', path });
  await page.setViewportSize(viewport);
};
