import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/**
 * A folding section inside a step, found by its summary's text. `<summary>` and `<details>` have no ARIA role Playwright
 * can name, so the summary is read by tag and the fold is its parent.
 */
const foldSummary = (page: Page, stepHeading: string, summary: string): Locator => {
  const step = page.getByRole('region', { name: stepHeading, exact: true });

  return step.locator('summary').filter({ hasText: summary });
};

export const toggleFold = async (page: Page, stepHeading: string, summary: string): Promise<void> => {
  await foldSummary(page, stepHeading, summary).click();
};

export const expectFoldOpen = async (page: Page, stepHeading: string, summary: string, isOpen: boolean): Promise<void> => {
  const toggle = foldSummary(page, stepHeading, summary);
  const fold = toggle.locator('xpath=..');
  const state = isOpen ? 'open' : 'folded';

  // The toggle must be on screen first, or "folded" would pass for a section that never rendered.
  await test.step(`THEN the "${summary}" section is ${state}`, async (): Promise<void> => {
    await expect(toggle).toBeVisible();

    if (isOpen) return expect(fold).toHaveAttribute('open');

    return expect(fold).not.toHaveAttribute('open');
  }, { box: true });
};
