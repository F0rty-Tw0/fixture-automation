import { test } from './ai-fill.fixture.ts';
import { AI_FILL_ROUTE } from './test/common/playwright.const.ts';
import type { AiFillOptions, ApiRoute } from './test/common/playwright.type.ts';
import { apiErrorMock } from './test/mocks/studio-api.mock.ts';
import { expectFillError, fillMissingValues } from './test/pages/ai-fill-panel.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import { TOO_MANY_RUNS_ERROR_STUB } from './test/stubs/workbench.stub.ts';

test.use({ allowedConsoleErrors: [/status of 429/u] });

test.describe('FEATURE: AI fill while every CLI slot is taken', () => {
  test('GIVEN every AI CLI slot taken, the 429 shows the API message and fix', async ({ page }): Promise<void> => {
    const busy: ApiRoute = { pattern: AI_FILL_ROUTE, handler: apiErrorMock(TOO_MANY_RUNS_ERROR_STUB, 429) };
    const routes = [busy];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the notice shows the API error', async (): Promise<void> => expectFillError(page, TOO_MANY_RUNS_ERROR_STUB));
  });
});
