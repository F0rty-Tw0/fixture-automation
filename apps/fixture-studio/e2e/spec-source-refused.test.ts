import { test } from './mocked-api.fixture.ts';
import { SPECS_ROUTE } from './test/common/playwright.const.ts';
import type { ApiRoute } from './test/common/playwright.type.ts';
import { apiErrorMock } from './test/mocks/studio-api.mock.ts';
import { expectApiError, loadSpecFromUrl, openStudio } from './test/pages/spec-step.page.ts';
import { SPEC_URL } from './test/pages/studio.page.ts';
import { SPEC_ERROR_STUB } from './test/stubs/studio-api.stub.ts';

test.use({ allowedConsoleErrors: [/status of 422/u] });

test.describe('FEATURE: a spec the API refuses', () => {
  test('GIVEN the API refuses the spec, the error body message and fix are shown', async ({ page }): Promise<void> => {
    const refused: ApiRoute = { pattern: SPECS_ROUTE, handler: apiErrorMock() };
    const routes = [refused];

    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page, { routes }));

    await test.step('AND a spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

    await test.step('THEN the notice shows the API error', async (): Promise<void> => expectApiError(page, SPEC_ERROR_STUB));
  });
});
