import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { TS_READER_TIMEOUT_MS } from '../common/playwright.const.ts';

/** The source may be a `.ts` file, whose first read loads the TypeScript compiler. */
const TS_READER_WAIT = { timeout: TS_READER_TIMEOUT_MS };

/** The Compare step of the endpoint chosen in Generate; the other endpoints' steps are hidden. */
const compareStep = (page: Page): Locator => page.getByRole('region', { name: 'Compare', exact: true });

/** The drop zone's input is the file picker; the file is read in the browser, never uploaded as a file. */
export const pickExistingFixture = async (page: Page, filePath: string): Promise<void> => {
  await compareStep(page).getByLabel('Drop an existing fixture').setInputFiles(filePath);
};

/** Lands `text` in the field the way a paste does: the whole value at once, then one `input` event for the form. */
const pasteInto = (element: Element, text: string): void => {
  if (!(element instanceof HTMLTextAreaElement)) throw new Error('the paste field is not a textarea');

  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * `fill` types through Chromium's editing path, which takes about 12s for 4000 lines even in a bare textarea, so a long
 * fixture would spend the test's whole budget arriving; the field is focused and handed the text in one go instead.
 */
export const pasteFixture = async (page: Page, text: string): Promise<void> => {
  const step = compareStep(page);
  const field = step.getByRole('textbox', { name: 'Or paste the fixture' });

  await field.focus();
  await field.evaluate(pasteInto, text);
  await step.getByRole('button', { name: 'Use pasted text' }).click();
};

const envelopeSelect = (page: Page): Locator => compareStep(page).getByRole('combobox', { name: 'Envelope property' });

/** The open list lives in an overlay outside the step. */
export const chooseEnvelope = async (page: Page, label: string): Promise<void> => {
  await envelopeSelect(page).click();
  await page.getByRole('option', { name: label, exact: true }).click();
};

/** Compare's own endpoint switch; the open list lives in an overlay outside the step. */
export const switchCompareEndpoint = async (page: Page, endpointId: string): Promise<void> => {
  await compareStep(page).getByRole('combobox', { name: 'Endpoint' }).click();
  await page.getByRole('option', { name: endpointId, exact: true }).click();
};

export const compareWithSchema = async (page: Page): Promise<void> => {
  await compareStep(page).getByRole('button', { name: 'Compare with schema' }).click();
};

export const nextChange = async (page: Page): Promise<void> => {
  await compareStep(page).getByRole('button', { name: 'Next change' }).click();
};

export const previousChange = async (page: Page): Promise<void> => {
  await compareStep(page).getByRole('button', { name: 'Previous change' }).click();
};

/**
 * The change map beside the diff. It is a pointer shortcut hidden from assistive tech (the Previous/Next buttons are the
 * accessible way), so it has no role and is found by its class.
 */
const changeMap = (page: Page): Locator => compareStep(page).locator('.code-view__map');

/** Scrolls the page, not the diff: the map sits beside the diff's own scroller, so the diff stays at its top. */
export const scrollToChangeMap = async (page: Page): Promise<void> => {
  await changeMap(page).scrollIntoViewIfNeeded();
};

/** Clicks the change map at its bottom edge, where the last change sits. */
export const clickChangeMapEnd = async (page: Page): Promise<void> => {
  const map = changeMap(page);
  const box = await map.boundingBox();
  const height = box?.height ?? 0;
  const bottom = { x: 4, y: Math.max(height - 2, 0) };

  await map.click({ position: bottom });
};

export const expectComparing = async (page: Page, sourceName: string): Promise<void> => {
  const loaded = compareStep(page).getByText(`Comparing ${sourceName}`);

  await test.step(
    `THEN ${sourceName} is the fixture being compared`,
    async (): Promise<void> => expect(loaded).toBeVisible(TS_READER_WAIT),
    {
      box: true
    }
  );
};

export const expectEnvelope = async (page: Page, label: string): Promise<void> => {
  const select = envelopeSelect(page);

  await test.step(`THEN the envelope property reads "${label}"`, async (): Promise<void> => expect(select).toHaveText(label), {
    box: true
  });
};

export const expectSourceRejected = async (page: Page, message: string): Promise<void> => {
  const alert = compareStep(page).getByRole('alert');

  await test.step(
    `THEN the fixture is rejected with "${message}"`,
    async (): Promise<void> => expect(alert).toHaveText(message, TS_READER_WAIT),
    {
      box: true
    }
  );
};

/**
 * The side-by-side merge view marks each inserted line in the document editor with `cm-changedLine`; CodeMirror exposes no role for
 * a diff line, so this one assertion reads the class.
 */
export const expectInsertedLine = async (page: Page, fileName: string, text: string): Promise<void> => {
  const editor = compareStep(page).getByRole('textbox', { name: fileName, exact: true });
  const inserted = editor.locator('.cm-changedLine').filter({ hasText: text });

  await test.step(`THEN the diff marks ${text} as inserted`, async (): Promise<void> => expect(inserted).toBeVisible(), { box: true });
};

/** The change map's counter, e.g. `1 change` or `Change 1 of 1, line 5`. */
export const expectChangeLabel = async (page: Page, label: string): Promise<void> => {
  const counter = compareStep(page).getByText(label, { exact: true });

  await test.step(`THEN the change map reads "${label}"`, async (): Promise<void> => expect(counter).toBeVisible(), { box: true });
};

/** Whether the diff line holding `text` shows inside the viewport; CodeMirror only renders lines near its scroll position. */
export const expectLineInView = async (page: Page, fileName: string, text: string, isInView: boolean): Promise<void> => {
  const editor = compareStep(page).getByRole('textbox', { name: fileName, exact: true });
  const line = editor.getByText(text);
  const state = isInView ? 'in view' : 'out of view';

  await test.step(`THEN the line ${text} is ${state}`, async (): Promise<void> => {
    if (isInView) return expect(line).toBeInViewport();

    return expect(line).not.toBeInViewport();
  }, { box: true });
};
