import { test } from './mocked-api.fixture.ts';
import { SPECS_ROUTE } from './test/common/playwright.const.ts';
import type { ApiRoute, StudioOptions } from './test/common/playwright.type.ts';
import { SCREENSHOT_VARIANTS } from './test/common/screenshot.const.ts';
import { apiErrorMock } from './test/mocks/studio-api.mock.ts';
import { expectApiError, loadSpecFromUrl, openStudio } from './test/pages/spec-step.page.ts';
import { SPEC_URL } from './test/pages/studio.page.ts';
import { SPEC_ERROR_STUB } from './test/stubs/studio-api.stub.ts';
import { capture } from './test/utils/screenshot.spec.util.ts';

test.use({ allowedConsoleErrors: [/status of 422/u] });

test.describe('FEATURE: screenshots of a refused spec', () => {
  for (const variant of SCREENSHOT_VARIANTS) {
    const { colorScheme, viewport } = variant;

    test(`GIVEN the API refuses the spec in ${variant.name}, the error notice is captured`, async ({ page }): Promise<void> => {
      const refused: ApiRoute = { pattern: SPECS_ROUTE, handler: apiErrorMock() };
      const routes = [refused];
      const options: StudioOptions = { colorScheme, routes, viewport };

      await test.step('WHEN the studio opens', async (): Promise<void> => openStudio(page, options));

      await test.step('AND the spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

      await test.step('THEN the notice shows the API error', async (): Promise<void> => expectApiError(page, SPEC_ERROR_STUB));

      await test.step('AND the error notice is captured', async (): Promise<void> => capture(page, variant.name, '06-spec-error'));
    });
  }
});
