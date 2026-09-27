import type { LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { loadSpecFromUrl, openStudio } from './spec-step.page.ts';
import { SPECS_ROUTE } from '../common/playwright.const.ts';
import type { RecordingRoute } from '../common/playwright.type.ts';
import { specsMock } from '../mocks/studio-api.mock.ts';
import { LOADED_SPEC_STUB } from '../stubs/studio-api.stub.ts';
import { unnamedControls } from '../utils/aria.spec.util.ts';
import { routeApi } from '../utils/route.spec.util.ts';

export const SPEC_URL = 'https://api.example.com/openapi.json';

/** Arrange shared by every scenario past step one: the studio open with `spec` loaded from a URL. */
export const openStudioWithSpec = async (page: Page, spec: LoadedSpec = LOADED_SPEC_STUB): Promise<RecordingRoute> => {
  const specs = specsMock(spec);

  await routeApi(page, SPECS_ROUTE, specs.handler);
  await openStudio(page);
  await loadSpecFromUrl(page, SPEC_URL);

  return specs;
};

const pageSnapshot = async (page: Page): Promise<string> => page.locator('body').ariaSnapshot();

/** Reads the whole page's accessibility tree; a button, checkbox, tab, or field without a name fails. */
export const expectEveryControlNamed = async (page: Page): Promise<void> => {
  const snapshot = await pageSnapshot(page);

  await test.step('THEN every control has an accessible name', (): void => expect(unnamedControls(snapshot)).toEqual([]), {
    box: true
  });
};
