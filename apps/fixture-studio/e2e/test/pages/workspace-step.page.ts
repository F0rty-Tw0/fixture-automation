import type { Download, Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { downloadText } from '../utils/download.spec.util.ts';

const workspaceRegion = (page: Page): Locator => page.getByRole('region', { name: 'Generate' });

/** Endpoint tabs are named by their endpoint id, `METHOD /path`; format sub-tabs by their label. */
const endpointTabs = (page: Page): Locator => workspaceRegion(page).getByRole('tab', { name: /^[A-Z]+ \//u });

/** Visited endpoint tabs keep their panel rendered off screen; only the selected one is visible. */
const activePanel = (page: Page): Locator => workspaceRegion(page).getByRole('tabpanel').filter({ visible: true });

/** A document's folding section: `<summary>` has no ARIA role of its own, so this one locator reads the element. */
const documentSummary = (page: Page, label: string): Locator => activePanel(page).locator('summary').filter({ hasText: label });

export const openEndpointTab = async (page: Page, endpointId: string): Promise<void> => {
  await workspaceRegion(page).getByRole('tab', { name: endpointId, exact: true }).click();
};

export const openDocument = async (page: Page, label: string): Promise<void> => {
  await documentSummary(page, label).click();
};

export const copyDocument = async (page: Page): Promise<void> => {
  await activePanel(page).getByRole('button', { name: 'Copy' }).click();
};

/** Resolves once the browser has started the download the Export button triggers. */
export const exportDocument = async (page: Page): Promise<Download> => {
  const downloadEvent = page.waitForEvent('download');

  await activePanel(page).getByRole('button', { name: 'Export' }).click();

  return downloadEvent;
};

/** The Windows clipboard hands text back with CRLF line ends; the copied document used LF. */
const readClipboard = async (page: Page): Promise<string> => {
  const text = await page.evaluate(async (): Promise<string> => navigator.clipboard.readText());

  return text.replaceAll('\r\n', '\n');
};

export const expectEndpointTabs = async (page: Page, endpointIds: string[]): Promise<void> => {
  const tabs = endpointTabs(page);

  await test.step(`THEN the workspace has a tab per endpoint`, async (): Promise<void> => expect(tabs).toHaveText(endpointIds), {
    box: true
  });
};

export const expectDocuments = async (page: Page, labels: string[]): Promise<void> => {
  const summaries = activePanel(page).locator('summary');

  await test.step(`THEN the endpoint has a folding section per format`, async (): Promise<void> => expect(summaries).toContainText(labels), {
    box: true
  });
};

/** CodeMirror's content element is the textbox named after the file it shows. */
export const expectCode = async (page: Page, fileName: string, text: string): Promise<void> => {
  const editor = activePanel(page).getByRole('textbox', { name: fileName, exact: true });

  await test.step(
    `THEN the editor for ${fileName} shows the document`,
    async (): Promise<void> => expect(editor).toContainText(text),
    { box: true }
  );
};

export const expectClipboard = async (page: Page, text: string): Promise<void> => {
  const clipboard = async (): Promise<string> => readClipboard(page);

  await test.step('THEN the clipboard holds the document', async (): Promise<void> => expect.poll(clipboard).toBe(text), {
    box: true
  });
};

export const expectDownload = async (download: Download, fileName: string, content: string): Promise<void> => {
  const text = await downloadText(download);

  await test.step(`THEN ${fileName} is downloaded`, (): void => expect(download.suggestedFilename()).toBe(fileName), { box: true });
  await test.step('AND the file holds the document', (): void => expect(text).toBe(content), { box: true });
};
