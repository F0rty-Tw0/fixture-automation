import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { escapeRegExp } from '../utils/regexp.spec.util.ts';
import { hiddenOverflow } from '../utils/scroll.spec.util.ts';

const missingStep = (page: Page): Locator => page.getByRole('region', { name: 'Missing & broken values' });

/** Unchecks the default "fix" choice, so the diff keeps every present value. */
export const keepBrokenValues = async (page: Page): Promise<void> => {
  await missingStep(page).getByRole('radio', { name: 'Keep broken values as they are' }).check();
};

export const continueToAiFill = async (page: Page): Promise<void> => {
  await missingStep(page).getByRole('button', { name: 'Continue to AI fill' }).click();
};

/** Missing paths are grouped by their first segment; every group of a small list is open, so each path is a visible item. */
export const expectMissingPaths = async (page: Page, paths: string[]): Promise<void> => {
  const items = missingStep(page).getByRole('region', { name: 'Missing paths' }).getByRole('listitem');

  await expect(items).toHaveText(paths);
};

/** Each broken value's row reads its path, then the value found, then why it is broken. */
export const expectBrokenValues = async (page: Page, paths: string[]): Promise<void> => {
  const items = missingStep(page).getByRole('list', { name: 'Broken values' }).getByRole('listitem');
  const rowPattern = (path: string): RegExp => new RegExp(`^${escapeRegExp(path)}`, 'u');
  const patterns = paths.map(rowPattern);

  await expect(items).toHaveText(patterns);
};

export const expectFillCount = async (page: Page, count: number): Promise<void> => {
  const noun = count === 1 ? 'value' : 'values';
  const counter = missingStep(page).getByText(`${count} ${noun} to fill`);

  await expect(counter).toBeVisible();
};

export const expectNothingMissing = async (page: Page): Promise<void> => {
  const complete = missingStep(page).getByText('Nothing is missing', { exact: false });

  await expect(complete).toBeVisible();
};

export const expectNothingToFill = async (page: Page): Promise<void> => {
  const continueButton = missingStep(page).getByRole('button', { name: 'Continue to AI fill' });

  await expect(continueButton).toHaveCount(0);
};

/** Long lists scroll inside their own capped boxes instead of stretching the step. */
export const expectListsScrollInside = async (page: Page): Promise<void> => {
  const step = missingStep(page);
  const missingOverflow = async (): Promise<number> => hiddenOverflow(step.getByRole('region', { name: 'Missing paths' }));
  const brokenOverflow = async (): Promise<number> => hiddenOverflow(step.getByRole('list', { name: 'Broken values' }));

  await expect.poll(missingOverflow).toBeGreaterThan(0);
  await expect.poll(brokenOverflow).toBeGreaterThan(0);
};
