import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

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

  await expect(loaded).toBeVisible(TS_READER_WAIT);
};

export const expectEnvelope = async (page: Page, label: string): Promise<void> => {
  const select = envelopeSelect(page);

  await expect(select).toHaveText(label);
};

export const expectSourceRejected = async (page: Page, message: string): Promise<void> => {
  const alert = compareStep(page).getByRole('alert');

  await expect(alert).toHaveText(message, TS_READER_WAIT);
};

/**
 * The side-by-side merge view marks each inserted line in the document editor with `cm-changedLine`; CodeMirror exposes no role for
 * a diff line, so this one assertion reads the class.
 */
export const expectInsertedLine = async (page: Page, fileName: string, text: string): Promise<void> => {
  const editor = compareStep(page).getByRole('textbox', { name: fileName, exact: true });
  const inserted = editor.locator('.cm-changedLine').filter({ hasText: text });

  await expect(inserted).toBeVisible();
};

/** The change map's counter, e.g. `1 change` or `Change 1 of 1, line 5`. */
export const expectChangeLabel = async (page: Page, label: string): Promise<void> => {
  const counter = compareStep(page).getByText(label, { exact: true });

  await expect(counter).toBeVisible();
};

/** The diff line holding `text`; CodeMirror only renders lines near its scroll position. */
const diffLine = (page: Page, fileName: string, text: string): Locator => {
  const editor = compareStep(page).getByRole('textbox', { name: fileName, exact: true });

  return editor.getByText(text);
};

export const expectLineInView = async (page: Page, fileName: string, text: string): Promise<void> => {
  const line = diffLine(page, fileName, text);

  await expect(line).toBeInViewport();
};

export const expectLineOutOfView = async (page: Page, fileName: string, text: string): Promise<void> => {
  const line = diffLine(page, fileName, text);

  await expect(line).not.toBeInViewport();
};

/** The legend above the diff: one entry per highlight outcome and gutter glyph on screen. */
export const expectHighlightLegend = async (page: Page, entries: string[]): Promise<void> => {
  const items = compareStep(page).getByRole('list', { name: 'Highlight legend' }).getByRole('listitem');

  await expect(items).toHaveText(entries);
};

/** The tooltip shown while a fix highlight is hovered; CodeMirror exposes no role for a tooltip, so this reads its class. */
const fixTooltip = (page: Page): Locator => compareStep(page).locator('.cm-fixTooltip');

/** Whether the tooltip is what shows just inside its top and bottom edges, so no scroller clips it and nothing covers it. */
const isOnTop = (tooltip: Element): boolean => {
  const box = tooltip.getBoundingClientRect();
  const middle = box.left + box.width / 2;
  const edges = [box.top + 2, box.bottom - 2];

  const isTooltipAt = (y: number): boolean => {
    const element = document.elementFromPoint(middle, y);

    return element !== null && tooltip.contains(element);
  };

  return edges.every(isTooltipAt);
};

/** The tooltip reads `rows` and can be seen: its text alone would pass while a scroller clips it away. */
const expectFixTooltip = async (page: Page, rows: string[]): Promise<void> => {
  const tooltip = fixTooltip(page);
  const tooltipOnTop = async (): Promise<boolean> => tooltip.evaluate(isOnTop);

  await expect(tooltip.locator(':scope > *')).toHaveText(rows);
  await expect.poll(tooltipOnTop).toBe(true);
};

/**
 * Hovering a highlighted value shows its meaning in a tooltip, e.g. `memo · Was missing · Generated from the schema`;
 * CodeMirror exposes no role for a line, so this finds the line by its highlight class.
 */
export const expectHighlightedValue = async (page: Page, fileName: string, text: string, rows: string[]): Promise<void> => {
  const editor = compareStep(page).getByRole('textbox', { name: fileName, exact: true });
  const line = editor.locator('.cm-line.cm-fix').filter({ hasText: text });

  await line.hover();
  await expectFixTooltip(page, rows);
};

/** Hovering a gutter glyph (`!` alone marks a value broken in the existing fixture) shows the same tooltip as its line. */
export const expectGlyphTooltip = async (page: Page, glyph: string, rows: string[]): Promise<void> => {
  const marker = compareStep(page).locator('.cm-fixMarker').getByText(glyph, { exact: true });

  await marker.hover();
  await expectFixTooltip(page, rows);
};
