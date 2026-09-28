import { test } from './mocked-api.fixture.ts';
import { PARTIAL_INVOICE_JSON_PATH } from './test/common/fixture-file.const.ts';
import { GENERATE_ROUTE, SPECS_ROUTE } from './test/common/playwright.const.ts';
import { SCREENSHOT_VARIANTS } from './test/common/screenshot.const.ts';
import { apiErrorMock, generateMock, specsMock } from './test/mocks/studio-api.mock.ts';
import { expectValidMerge, fillMissingValues, openAiFillTab } from './test/pages/ai-fill-panel.page.ts';
import { expectMissingPaths, pickExistingFixture } from './test/pages/compare-panel.page.ts';
import { generate, selectAllVisible } from './test/pages/endpoints-step.page.ts';
import { expectApiError, expectSpecLoaded, loadSpecFromUrl, openStudio } from './test/pages/spec-step.page.ts';
import { SPEC_URL } from './test/pages/studio.page.ts';
import { openInvoiceCompare, routeWorkbenchApi } from './test/pages/workbench.page.ts';
import { expectCode, expectEndpointTabs, openFormatTab } from './test/pages/workspace-step.page.ts';
import { GENERATE_RESULT_STUB, LOADED_SPEC_STUB, SPEC_ERROR_STUB } from './test/stubs/studio-api.stub.ts';
import { DIFF_RESULT_STUB } from './test/stubs/workbench.stub.ts';
import { routeApi } from './test/utils/route.spec.util.ts';
import { capture } from './test/utils/screenshot.spec.util.ts';

const GENERATED_IDS = GENERATE_RESULT_STUB.fixtures.map((fixture): string => fixture.endpointId);

for (const variant of SCREENSHOT_VARIANTS) {
  test.describe(`FEATURE: screenshots in ${variant.name}`, () => {
    test.use({ colorScheme: variant.colorScheme, viewport: variant.viewport });

    test('SCENARIO: the generation flow is captured at every step', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API serves the billing spec', async (): Promise<void> =>
        routeApi(page, SPECS_ROUTE, specsMock().handler));

      await test.step('AND the API generates fixtures', async (): Promise<void> =>
        routeApi(page, GENERATE_ROUTE, generateMock().handler));

      await test.step('WHEN the studio opens', async (): Promise<void> => openStudio(page));

      await test.step('THEN the empty studio is captured', async (): Promise<void> => capture(page, variant.name, '01-empty'));

      await test.step('AND the spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

      await test.step('THEN the spec is shown', async (): Promise<void> => expectSpecLoaded(page, LOADED_SPEC_STUB.title));

      await test.step('AND the endpoint list is captured', async (): Promise<void> => capture(page, variant.name, '02-endpoints'));

      await test.step('AND every visible endpoint is selected', async (): Promise<void> => selectAllVisible(page));

      await test.step('THEN the selection is captured', async (): Promise<void> => capture(page, variant.name, '03-selected'));

      await test.step('AND generate is pressed', async (): Promise<void> => generate(page));

      await test.step('THEN the workspace shows the result', async (): Promise<void> => expectEndpointTabs(page, GENERATED_IDS));

      await test.step('AND the editor shows the invoice JSON', async (): Promise<void> =>
        expectCode(page, 'invoice.json', '"id": "in_123"'));

      await test.step('AND the JSON document is captured', async (): Promise<void> =>
        capture(page, variant.name, '04-workspace-json'));

      await test.step('AND the TS stub sub-tab is opened', async (): Promise<void> => openFormatTab(page, 'TS stub'));

      await test.step('THEN the editor shows the invoice stub', async (): Promise<void> =>
        expectCode(page, 'invoice.stub.ts', 'export const INVOICE_STUB'));

      await test.step('AND the TS stub document is captured', async (): Promise<void> =>
        capture(page, variant.name, '05-workspace-stub'));
    });

    test('SCENARIO: the compare and AI fill flow is captured at every step', async ({ page }): Promise<void> => {
      await test.step('GIVEN the workbench API answers every call', async (): Promise<void> => routeWorkbenchApi(page));

      await test.step('WHEN the Compare tab of the invoice is opened', async (): Promise<void> => openInvoiceCompare(page));

      await test.step('THEN the empty compare panel is captured', async (): Promise<void> =>
        capture(page, variant.name, '07-compare'));

      await test.step('AND the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the diff is captured', async (): Promise<void> => capture(page, variant.name, '08-compare-diff'));

      await test.step('AND the AI fill tab is opened', async (): Promise<void> => openAiFillTab(page));

      await test.step('THEN the AI fill panel is captured', async (): Promise<void> => capture(page, variant.name, '09-ai-fill'));

      await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the merge is valid', async (): Promise<void> =>
        expectValidMerge(page, DIFF_RESULT_STUB.missingPaths.length));

      await test.step('AND the merged fixture is captured', async (): Promise<void> =>
        capture(page, variant.name, '10-ai-fill-merged'));
    });

    test.describe('GIVEN the API refuses the spec', () => {
      test.use({ allowedConsoleErrors: [/status of 422/u] });

      test('SCENARIO: the error notice is captured', async ({ page }): Promise<void> => {
        await test.step('GIVEN the API answers 422 with an error body', async (): Promise<void> =>
          routeApi(page, SPECS_ROUTE, apiErrorMock()));

        await test.step('WHEN the studio opens', async (): Promise<void> => openStudio(page));

        await test.step('AND the spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

        await test.step('THEN the notice shows the API error', async (): Promise<void> => expectApiError(page, SPEC_ERROR_STUB));

        await test.step('AND the error notice is captured', async (): Promise<void> => capture(page, variant.name, '06-spec-error'));
      });
    });
  });
}
