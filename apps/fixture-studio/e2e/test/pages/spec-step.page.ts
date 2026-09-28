import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import type { ElementBox, StudioOptions } from '../common/playwright.type.ts';
import { routeAll } from '../utils/route.spec.util.ts';

const specRegion = (page: Page): Locator => page.getByRole('region', { name: 'Spec' });

const dropZone = (page: Page): Locator => specRegion(page).getByRole('button', { name: /Drop a JSON spec/u });

/** Opens the studio with the options applied first: the window, the color scheme, the permissions, and the scenario's routes. */
export const openStudio = async (page: Page, options: StudioOptions = {}): Promise<void> => {
  const routes = options.routes ?? [];

  if (options.viewport !== undefined) await page.setViewportSize(options.viewport);

  if (options.colorScheme !== undefined) await page.emulateMedia({ colorScheme: options.colorScheme });

  if (options.permissions !== undefined) await page.context().grantPermissions(options.permissions);

  await routeAll(page, routes);
  await page.goto('/');
};

/** Whether every animation that ends has ended; an endless one (a spinner) never does, so it is left out. */
const isSettled = (): boolean => {
  const isStillMoving = (animation: Animation): boolean => {
    const isEndless = animation.effect?.getTiming().iterations === Infinity;

    return animation.playState === 'running' && !isEndless;
  };

  return !document.getAnimations().some(isStillMoving);
};

/**
 * Boxes of the drop zone and the Endpoints step, to prove a validation message moves neither. The file input inside the
 * drop zone is a 1px stand-in, so the zone is measured by its host element. The steps slide in on first render, and a box
 * measured mid-slide is off by a fraction of a pixel, so the slide must end first.
 */
const sourceLayout = async (page: Page): Promise<ElementBox[]> => {
  const drop = specRegion(page).locator('fs-file-drop');
  const endpoints = page.getByRole('region', { name: 'Endpoints' });

  await page.waitForFunction(isSettled);

  return Promise.all([drop.boundingBox(), endpoints.boundingBox()]);
};

/** Presses Load spec as it stands, with whatever URL the field holds; resolves to the source row's layout just before the press. */
export const submitSpecUrl = async (page: Page): Promise<ElementBox[]> => {
  const before = await sourceLayout(page);

  await specRegion(page).getByRole('button', { name: 'Load spec' }).click();

  return before;
};

export const loadSpecFromUrl = async (page: Page, url: string): Promise<void> => {
  const region = specRegion(page);

  await region.getByRole('textbox', { name: 'Spec URL' }).fill(url);
  await region.getByRole('button', { name: 'Load spec' }).click();
};

/** Picks the file through the browser's file chooser, the way a user clicking the drop zone does. */
export const loadSpecFromFile = async (page: Page, filePath: string): Promise<void> => {
  const chooserEvent = page.waitForEvent('filechooser');

  await dropZone(page).click();

  const chooser = await chooserEvent;

  await chooser.setFiles(filePath);
};

export const expectSpecLoaded = async (page: Page, title: string): Promise<void> => {
  const heading = page.getByRole('region', { name: 'Endpoints' }).getByRole('heading', { name: title, level: 3 });

  await expect(heading).toBeVisible();
};

export const expectUrlRequired = async (page: Page): Promise<void> => {
  const message = specRegion(page).getByText('Enter the URL of an OpenAPI JSON document.');

  await expect(message).toBeVisible();
};

export const expectFileRejected = async (page: Page, message: string): Promise<void> => {
  const alert = specRegion(page).getByRole('alert');

  await expect(alert).toHaveText(message);
};

/** The notice shows the API's `message` line, then its `fix` line. */
export const expectApiError = async (page: Page, error: ApiErrorBody): Promise<void> => {
  const paragraphs = specRegion(page).getByRole('alert').getByRole('paragraph');
  const candidates = [error.message, error.fix];
  const lines = candidates.filter((line: string | undefined): line is string => line !== undefined);

  await expect(paragraphs).toContainText(lines);
};

/** Neither the drop zone nor the Endpoints step moved from where they were `before`. */
export const expectSourceLayout = async (page: Page, before: ElementBox[]): Promise<void> => {
  const after = await sourceLayout(page);

  expect(after).toEqual(before);
};
