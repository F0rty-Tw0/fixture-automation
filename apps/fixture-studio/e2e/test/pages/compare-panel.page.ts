import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { TS_READER_TIMEOUT_MS } from '../common/playwright.const.ts';

/** The source may be a `.ts` file, whose first read loads the TypeScript compiler. */
const TS_READER_WAIT = { timeout: TS_READER_TIMEOUT_MS };

const workspaceRegion = (page: Page): Locator => page.getByRole('region', { name: 'Workspace' });

const comparePanel = (page: Page): Locator => workspaceRegion(page).getByRole('tabpanel', { name: 'Compare' });

export const openCompareTab = async (page: Page): Promise<void> => {
  await workspaceRegion(page).getByRole('tab', { name: 'Compare', exact: true }).click();
};

/** The drop zone's input is the file picker; the file is read in the browser, never uploaded as a file. */
export const pickExistingFixture = async (page: Page, filePath: string): Promise<void> => {
  await comparePanel(page).getByLabel('Drop an existing fixture').setInputFiles(filePath);
};

export const pasteFixture = async (page: Page, text: string): Promise<void> => {
  const panel = comparePanel(page);

  await panel.getByRole('textbox', { name: 'Or paste the fixture' }).fill(text);
  await panel.getByRole('button', { name: 'Use pasted text' }).click();
};

export const setEnvelopeProperty = async (page: Page, property: string): Promise<void> => {
  await comparePanel(page).getByRole('textbox', { name: 'Envelope property' }).fill(property);
};

/** Unchecks "Replace placeholder and invalid values", so the diff keeps every present value. */
export const keepPlaceholders = async (page: Page): Promise<void> => {
  await comparePanel(page).getByRole('checkbox', { name: 'Replace placeholder and invalid values' }).uncheck();
};

export const compareWithSchema = async (page: Page): Promise<void> => {
  await comparePanel(page).getByRole('button', { name: 'Compare with schema' }).click();
};

/** The compare result's shortcut to the AI fill tab, named by how many values it would fill. */
export const fillWithAi = async (page: Page, fillCount: number): Promise<void> => {
  const noun = fillCount === 1 ? 'value' : 'values';
  const name = `Fill ${fillCount} ${noun} with AI`;

  await comparePanel(page).getByRole('button', { name }).click();
};

export const expectComparing = async (page: Page, sourceName: string): Promise<void> => {
  const loaded = comparePanel(page).getByText(`Comparing ${sourceName}`);

  await test.step(
    `THEN ${sourceName} is the fixture being compared`,
    async (): Promise<void> => expect(loaded).toBeVisible(TS_READER_WAIT),
    {
      box: true
    }
  );
};

export const expectSourceRejected = async (page: Page, message: string): Promise<void> => {
  const alert = comparePanel(page).getByRole('alert');

  await test.step(
    `THEN the fixture is rejected with "${message}"`,
    async (): Promise<void> => expect(alert).toHaveText(message, TS_READER_WAIT),
    {
      box: true
    }
  );
};

export const expectMissingPaths = async (page: Page, paths: string[]): Promise<void> => {
  const items = comparePanel(page).getByRole('list', { name: 'Missing paths' }).getByRole('listitem');

  await test.step(`THEN the missing paths are ${paths.join(', ')}`, async (): Promise<void> => expect(items).toHaveText(paths), {
    box: true
  });
};

export const expectReplacedPaths = async (page: Page, paths: string[]): Promise<void> => {
  const items = comparePanel(page).getByRole('list', { name: 'Replaced values' }).getByRole('listitem');

  await test.step(`THEN the replaced values are ${paths.join(', ')}`, async (): Promise<void> => expect(items).toHaveText(paths), {
    box: true
  });
};

export const expectNothingMissing = async (page: Page): Promise<void> => {
  const complete = comparePanel(page).getByText('Nothing is missing', { exact: false });

  await test.step('THEN the fixture is reported complete', async (): Promise<void> => expect(complete).toBeVisible(), { box: true });
};

/**
 * The side-by-side merge view marks each inserted line in the document editor with `cm-changedLine`; CodeMirror exposes no role for
 * a diff line, so this one assertion reads the class.
 */
export const expectInsertedLine = async (page: Page, fileName: string, text: string): Promise<void> => {
  const editor = comparePanel(page).getByRole('textbox', { name: fileName, exact: true });
  const inserted = editor.locator('.cm-changedLine').filter({ hasText: text });

  await test.step(`THEN the diff marks ${text} as inserted`, async (): Promise<void> => expect(inserted).toBeVisible(), { box: true });
};
