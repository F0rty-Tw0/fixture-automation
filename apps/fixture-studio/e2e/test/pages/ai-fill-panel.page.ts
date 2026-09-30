import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';
import type { Download, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** The Fill with AI step of the endpoint chosen in Generate. */
export const aiFillPanel = (page: Page): Locator => page.getByRole('region', { name: 'Fill with AI' });

const mergeResult = (page: Page): Locator => aiFillPanel(page).getByRole('region', { name: 'Merge result' });

const generatedFallback = (page: Page): Locator => aiFillPanel(page).getByRole('region', { name: 'Generated fallback' });

const providerRegion = (page: Page): Locator => aiFillPanel(page).getByRole('region', { name: 'AI provider' });

export const chromeOptIn = (page: Page): Locator => aiFillPanel(page).getByRole('checkbox', { name: 'Use on-device Chrome AI' });

export const toggleChromeOptIn = async (page: Page): Promise<void> => {
  await chromeOptIn(page).click();
};

const cliSelect = (page: Page): Locator => aiFillPanel(page).getByRole('combobox', { name: 'CLI' });

export const openCliList = async (page: Page): Promise<void> => {
  await cliSelect(page).click();
};

export const expectChosenCli = async (page: Page, tool: string): Promise<void> => {
  const select = cliSelect(page);

  await expect(select).toHaveText(tool);
};

/** The open CLI list lives in an overlay outside the panel. */
export const expectCliNotInstalled = async (page: Page, tool: string): Promise<void> => {
  const option = page.getByRole('option', { name: `${tool} — not installed` });

  await expect(option).toBeDisabled();
};

export const expectMockAiBadge = async (page: Page): Promise<void> => {
  const badge = aiFillPanel(page).getByText('Mock AI — no CLI runs', { exact: true });

  await expect(badge).toBeVisible();
};

export const downloadModel = async (page: Page): Promise<void> => {
  await aiFillPanel(page).getByRole('button', { name: 'Download model' }).click();
};

export const fillMissingValues = async (page: Page): Promise<void> => {
  await aiFillPanel(page).getByRole('button', { name: 'Fill missing values' }).click();
};

export const cancelFill = async (page: Page): Promise<void> => {
  await aiFillPanel(page).getByRole('button', { name: 'Cancel' }).click();
};

export const exportMerged = async (page: Page): Promise<Download> => {
  const downloadEvent = page.waitForEvent('download');

  await mergeResult(page).getByRole('button', { name: 'Export' }).click();

  return downloadEvent;
};

/** Before the user continues from the missing values, the AI step only says what it waits for. */
export const expectAiFillWaiting = async (page: Page): Promise<void> => {
  const fill = aiFillPanel(page).getByRole('button', { name: 'Fill missing values' });

  await expect(fill).toHaveCount(0);
};

export const expectAiFillOpen = async (page: Page): Promise<void> => {
  const fill = aiFillPanel(page).getByRole('button', { name: 'Fill missing values' });

  await expect(fill).toBeVisible();
};

export const expectFillDisabled = async (page: Page): Promise<void> => {
  const fill = aiFillPanel(page).getByRole('button', { name: 'Fill missing values' });

  await expect(fill).toBeDisabled();
};

export const expectNoModelYet = async (page: Page): Promise<void> => {
  const notice = aiFillPanel(page).getByText('No on-device model on this machine yet', { exact: false });

  await expect(notice).toBeVisible();
};

export const expectModelReady = async (page: Page): Promise<void> => {
  const notice = aiFillPanel(page).getByText('The on-device model is ready.');

  await expect(notice).toBeVisible();
};

/** The provider chip is the one element whose whole text is the provider's label; the copy around it may change. */
export const expectProvider = async (page: Page, label: string): Promise<void> => {
  const chip = providerRegion(page).getByText(label, { exact: true });

  await expect(chip).toBeVisible();
};

/** Past the on-device prompt limit the opt-in is not offered at all; the provider section says why instead. */
export const expectTooLargeForChromeAi = async (page: Page): Promise<void> => {
  const note = providerRegion(page).getByText('This fixture is too large for on-device Chrome AI, so the local CLI fills it.');

  const optIn = chromeOptIn(page);

  await expect(optIn).toHaveCount(0);
  await expect(note).toBeVisible();
};

export const expectAvailability = async (page: Page, label: string): Promise<void> => {
  const availability = aiFillPanel(page).getByText(`Chrome AI: ${label}`);

  await expect(availability).toBeVisible();
};

export const expectLogLine = async (page: Page, text: string): Promise<void> => {
  const log = aiFillPanel(page).getByRole('log', { name: 'AI progress' });

  await expect(log).toContainText(text);
};

export const expectValidMerge = async (page: Page, filledCount: number): Promise<void> => {
  const badge = mergeResult(page).getByText(`Valid against the schema · ${filledCount} values filled`);

  await expect(badge).toBeVisible();
};

export const expectSchemaErrors = async (page: Page, errors: string[]): Promise<void> => {
  const items = mergeResult(page).getByRole('list', { name: 'Schema errors' }).getByRole('listitem');

  await expect(items).toHaveText(errors);
};

export const expectMergedCode = async (page: Page, fileName: string, text: string): Promise<void> => {
  const editor = mergeResult(page).getByRole('textbox', { name: fileName, exact: true });

  await expect(editor).toContainText(text);
};

/** A fresh compare resets AI fill: no merge result is left from the previous fixture. */
export const expectNoMergeResult = async (page: Page): Promise<void> => {
  const result = mergeResult(page);

  await expect(result).toHaveCount(0);
};

/** An empty log is not rendered at all, so "cleared" means no log holds the text, whether or not one is shown. */
export const expectLogCleared = async (page: Page, text: string): Promise<void> => {
  const staleLog = aiFillPanel(page).getByRole('log', { name: 'AI progress' }).filter({ hasText: text });

  await expect(staleLog).toHaveCount(0);
};

export const expectDownloadProgress = async (page: Page, percent: number): Promise<void> => {
  const bar = aiFillPanel(page).getByRole('progressbar', { name: 'Model download' });

  await expect(bar).toHaveAttribute('aria-valuenow', String(percent));
};

export const expectFillError = async (page: Page, error: ApiErrorBody): Promise<void> => {
  const paragraphs = aiFillPanel(page).getByRole('alert').getByRole('paragraph');
  const candidates = [error.message, error.fix];
  const lines = candidates.filter((line: string | undefined): line is string => line !== undefined);

  await expect(paragraphs).toContainText(lines);
};

/** A failed fill leaves the schema-complete fixture in its place, ready to export. */
export const expectGeneratedFallback = async (page: Page, fileName: string, text: string): Promise<void> => {
  const editor = generatedFallback(page).getByRole('textbox', { name: fileName, exact: true });

  await expect(editor).toContainText(text);
};

export const expectFillNotes = async (page: Page, notes: (RegExp | string)[]): Promise<void> => {
  const items = aiFillPanel(page).getByRole('status', { name: 'Notes from the fill' }).getByRole('listitem');

  await expect(items).toHaveText(notes);
};

/** The merge lists every filled path with where its value came from, e.g. `Filled by AI`. */
export const expectFilledSource = async (page: Page, path: string, source: string): Promise<void> => {
  const items = mergeResult(page).getByRole('list', { name: 'Filled values by source' }).getByRole('listitem');
  const item = items.filter({ hasText: path });

  await expect(item).toContainText(source);
};
