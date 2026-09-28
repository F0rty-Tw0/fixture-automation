import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';
import type { Download, Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const workspaceRegion = (page: Page): Locator => page.getByRole('region', { name: 'Workspace' });

const aiFillTab = (page: Page): Locator => workspaceRegion(page).getByRole('tab', { name: 'AI fill', exact: true });

const aiFillPanel = (page: Page): Locator => workspaceRegion(page).getByRole('tabpanel', { name: 'AI fill' });

const mergeResult = (page: Page): Locator => aiFillPanel(page).getByRole('region', { name: 'Merge result' });

export const chromeOptIn = (page: Page): Locator => aiFillPanel(page).getByRole('checkbox', { name: 'Use on-device Chrome AI' });

export const openAiFillTab = async (page: Page): Promise<void> => {
  await aiFillTab(page).click();
};

export const toggleChromeOptIn = async (page: Page): Promise<void> => {
  await chromeOptIn(page).click();
};

const cliSelect = (page: Page): Locator => aiFillPanel(page).getByRole('combobox', { name: 'CLI' });

export const openCliList = async (page: Page): Promise<void> => {
  await cliSelect(page).click();
};

export const expectChosenCli = async (page: Page, tool: string): Promise<void> => {
  const select = cliSelect(page);

  await test.step(`THEN the CLI is ${tool}`, async (): Promise<void> => expect(select).toHaveText(tool), { box: true });
};

/** The open CLI list lives in an overlay outside the panel. */
export const expectCliNotInstalled = async (page: Page, tool: string): Promise<void> => {
  const option = page.getByRole('option', { name: `${tool} — not installed` });

  await test.step(`THEN ${tool} is offered disabled as not installed`, async (): Promise<void> => expect(option).toBeDisabled(), {
    box: true
  });
};

export const expectMockAiBadge = async (page: Page): Promise<void> => {
  const badge = aiFillPanel(page).getByText('Mock AI — no CLI runs', { exact: true });

  await test.step('THEN the mock AI is badged', async (): Promise<void> => expect(badge).toBeVisible(), { box: true });
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

export const expectAiFillDisabled = async (page: Page): Promise<void> => {
  const tab = aiFillTab(page);

  await test.step('THEN the AI fill tab stays disabled', async (): Promise<void> => expect(tab).toBeDisabled(), { box: true });
};

/** The provider chip is the one element whose whole text is the provider's label; the copy around it may change. */
export const expectAiFillOpen = async (page: Page): Promise<void> => {
  const tab = aiFillTab(page);

  await test.step(
    'THEN the AI fill tab is selected',
    async (): Promise<void> => expect(tab).toHaveAttribute('aria-selected', 'true'),
    {
      box: true
    }
  );
};

export const expectProvider = async (page: Page, label: string): Promise<void> => {
  const provider = aiFillPanel(page).getByRole('region', { name: 'AI provider' });
  const chip = provider.getByText(label, { exact: true });

  await test.step(`THEN the provider is ${label}`, async (): Promise<void> => expect(chip).toBeVisible(), { box: true });
};

export const expectAvailability = async (page: Page, label: string): Promise<void> => {
  const availability = aiFillPanel(page).getByText(`Chrome AI: ${label}`);

  await test.step(`THEN Chrome AI reads "${label}"`, async (): Promise<void> => expect(availability).toBeVisible(), { box: true });
};

export const expectLogLine = async (page: Page, text: string): Promise<void> => {
  const log = aiFillPanel(page).getByRole('log', { name: 'AI progress' });

  await test.step(`THEN the progress log shows "${text}"`, async (): Promise<void> => expect(log).toContainText(text), { box: true });
};

export const expectValidMerge = async (page: Page, filledCount: number): Promise<void> => {
  const badge = mergeResult(page).getByText(`Valid against the schema · ${filledCount} values filled`);

  await test.step('THEN the merged fixture is valid', async (): Promise<void> => expect(badge).toBeVisible(), { box: true });
};

export const expectSchemaErrors = async (page: Page, errors: string[]): Promise<void> => {
  const items = mergeResult(page).getByRole('list', { name: 'Schema errors' }).getByRole('listitem');

  await test.step('THEN the schema errors are listed', async (): Promise<void> => expect(items).toHaveText(errors), { box: true });
};

export const expectMergedCode = async (page: Page, fileName: string, text: string): Promise<void> => {
  const editor = mergeResult(page).getByRole('textbox', { name: fileName, exact: true });

  await test.step(
    `THEN the merged ${fileName} shows the filled values`,
    async (): Promise<void> => expect(editor).toContainText(text),
    {
      box: true
    }
  );
};

/** A fresh compare resets AI fill: no merge result is left from the previous fixture. */
export const expectNoMergeResult = async (page: Page): Promise<void> => {
  const result = mergeResult(page);

  await test.step('THEN no merge result is shown', async (): Promise<void> => expect(result).toHaveCount(0), { box: true });
};

/** An empty log is not rendered at all, so "cleared" means no log holds the text, whether or not one is shown. */
export const expectLogCleared = async (page: Page, text: string): Promise<void> => {
  const staleLog = aiFillPanel(page).getByRole('log', { name: 'AI progress' }).filter({ hasText: text });

  await test.step(`THEN the progress log no longer shows "${text}"`, async (): Promise<void> => expect(staleLog).toHaveCount(0), {
    box: true
  });
};

export const expectDownloadProgress = async (page: Page, percent: number): Promise<void> => {
  const bar = aiFillPanel(page).getByRole('progressbar', { name: 'Model download' });

  await test.step(
    `THEN the model download shows ${percent}%`,
    async (): Promise<void> => expect(bar).toHaveAttribute('aria-valuenow', String(percent)),
    { box: true }
  );
};

export const expectFillError = async (page: Page, error: ApiErrorBody): Promise<void> => {
  const paragraphs = aiFillPanel(page).getByRole('alert').getByRole('paragraph');
  const candidates = [error.message, error.fix];
  const lines = candidates.filter((line: string | undefined): line is string => line !== undefined);

  await test.step(
    'THEN the notice shows the message and the fix',
    async (): Promise<void> => expect(paragraphs).toContainText(lines),
    {
      box: true
    }
  );
};
