import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { loadSpecFromUrl, openStudio } from './spec-step.page.ts';
import { SPECS_ROUTE } from '../common/playwright.const.ts';
import type { StudioOptions } from '../common/playwright.type.ts';
import { specsMock } from '../mocks/studio-api.mock.ts';
import { unnamedControls } from '../utils/aria.spec.util.ts';
import { apiRoute } from '../utils/route.spec.util.ts';

export const SPEC_URL = 'https://api.example.com/openapi.json';

/** Arrange shared by every scenario past step one: the studio open with the options' spec, the billing spec by default, loaded. */
export const openStudioWithSpec = async (page: Page, options: StudioOptions = {}): Promise<void> => {
  const specs = specsMock(options.spec);
  const scenarioRoutes = options.routes ?? [];
  const routes = [apiRoute(SPECS_ROUTE, specs), ...scenarioRoutes];
  const studioOptions: StudioOptions = { ...options, routes };

  await openStudio(page, studioOptions);
  await loadSpecFromUrl(page, SPEC_URL);
};

const pageSnapshot = async (page: Page): Promise<string> => page.locator('body').ariaSnapshot();

/** Reads the whole page's accessibility tree; a button, checkbox, tab, or field without a name fails. */
export const expectEveryControlNamed = async (page: Page): Promise<void> => {
  const snapshot = await pageSnapshot(page);
  const unnamed = unnamedControls(snapshot);

  expect(unnamed).toEqual([]);
};
