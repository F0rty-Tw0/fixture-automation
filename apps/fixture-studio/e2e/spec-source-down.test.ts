import { test } from './mocked-api.fixture.ts';
import { SPECS_ROUTE } from './test/common/playwright.const.ts';
import type { ApiRoute } from './test/common/playwright.type.ts';
import { unreachableMock } from './test/mocks/studio-api.mock.ts';
import { expectApiError, loadSpecFromUrl, openStudio } from './test/pages/spec-step.page.ts';
import { SPEC_URL } from './test/pages/studio.page.ts';
import { UNREACHABLE_ERROR_STUB } from './test/stubs/studio-api.stub.ts';

test.use({ allowedConsoleErrors: [/status of 502/u] });

test.describe('FEATURE: loading a spec while the API is down', () => {
  test('GIVEN the API process is down, the notice says the API did not answer', async ({ page }): Promise<void> => {
    const unreachable: ApiRoute = { pattern: SPECS_ROUTE, handler: unreachableMock() };
    const routes = [unreachable];

    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page, { routes }));

    await test.step('AND a spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

    await test.step('THEN the notice explains the API did not answer', async (): Promise<void> =>
      expectApiError(page, UNREACHABLE_ERROR_STUB));
  });
});
