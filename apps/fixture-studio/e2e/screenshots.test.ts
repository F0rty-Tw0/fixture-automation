import { test } from './mocked-api.fixture.ts';
import { PARTIAL_INVOICE_JSON_PATH } from './test/common/fixture-file.const.ts';
import { GENERATE_ROUTE, SPECS_ROUTE } from './test/common/playwright.const.ts';
import type { StudioOptions } from './test/common/playwright.type.ts';
import { SCREENSHOT_VARIANTS } from './test/common/screenshot.const.ts';
import { generateMock, specsMock } from './test/mocks/studio-api.mock.ts';
import { expectValidMerge, fillMissingValues } from './test/pages/ai-fill-panel.page.ts';
import { pickExistingFixture } from './test/pages/compare-panel.page.ts';
import { generate, selectAllVisible } from './test/pages/endpoints-step.page.ts';
import { continueToAiFill, expectMissingPaths } from './test/pages/missing-values-step.page.ts';
import { expectSpecLoaded, loadSpecFromUrl, openStudio } from './test/pages/spec-step.page.ts';
import { SPEC_URL } from './test/pages/studio.page.ts';
import { openInvoiceCompare, workbenchRoutes } from './test/pages/workbench.page.ts';
import { expectCode, expectEndpointTabs, openFormatTab } from './test/pages/workspace-step.page.ts';
import { GENERATE_RESULT_STUB, LOADED_SPEC_STUB } from './test/stubs/studio-api.stub.ts';
import { DIFF_RESULT_STUB } from './test/stubs/workbench.stub.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';
import { capture } from './test/utils/screenshot.spec.util.ts';

const GENERATED_IDS = GENERATE_RESULT_STUB.fixtures.map((fixture): string => fixture.endpointId);

test.describe('FEATURE: screenshots of every step', () => {
  for (const variant of SCREENSHOT_VARIANTS) {
    const { colorScheme, viewport } = variant;

    test(`GIVEN the billing spec in ${variant.name}, the generation flow is captured at every step`, async ({
      page
    }): Promise<void> => {
      const routes = [apiRoute(SPECS_ROUTE, specsMock()), apiRoute(GENERATE_ROUTE, generateMock())];
      const options: StudioOptions = { colorScheme, routes, viewport };

      await test.step('WHEN the studio opens', async (): Promise<void> => openStudio(page, options));

      await test.step('THEN the empty studio is captured', async (): Promise<void> => capture(page, variant.name, '01-empty'));

      await test.step('WHEN the spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

      await test.step('THEN the spec is shown', async (): Promise<void> => expectSpecLoaded(page, LOADED_SPEC_STUB.title));

      await test.step('AND the endpoint list is captured', async (): Promise<void> => capture(page, variant.name, '02-endpoints'));

      await test.step('WHEN every visible endpoint is selected', async (): Promise<void> => selectAllVisible(page));

      await test.step('THEN the selection is captured', async (): Promise<void> => capture(page, variant.name, '03-selected'));

      await test.step('WHEN generate is pressed', async (): Promise<void> => generate(page));

      await test.step('THEN the workspace shows the result', async (): Promise<void> => expectEndpointTabs(page, GENERATED_IDS));

      await test.step('AND the editor shows the invoice JSON', async (): Promise<void> =>
        expectCode(page, 'invoice.json', '"id": "in_123"'));

      await test.step('AND the JSON document is captured', async (): Promise<void> =>
        capture(page, variant.name, '04-workspace-json'));

      await test.step('WHEN the TS stub tab is opened', async (): Promise<void> => openFormatTab(page, 'TS stub'));

      await test.step('THEN the editor shows the invoice stub', async (): Promise<void> =>
        expectCode(page, 'invoice.stub.ts', 'export const INVOICE_STUB'));

      await test.step('AND the TS stub document is captured', async (): Promise<void> =>
        capture(page, variant.name, '05-workspace-stub'));
    });

    test(`GIVEN a partial invoice in ${variant.name}, the compare and AI fill flow is captured at every step`, async ({
      page
    }): Promise<void> => {
      const routes = workbenchRoutes();
      const options: StudioOptions = { colorScheme, routes, viewport };

      await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page, options));

      await test.step('THEN the empty compare panel is captured', async (): Promise<void> =>
        capture(page, variant.name, '07-compare'));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the diff is captured', async (): Promise<void> => capture(page, variant.name, '08-compare-diff'));

      await test.step('WHEN the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

      await test.step('THEN the AI fill panel is captured', async (): Promise<void> => capture(page, variant.name, '09-ai-fill'));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the merge is valid', async (): Promise<void> =>
        expectValidMerge(page, DIFF_RESULT_STUB.missingPaths.length));

      await test.step('AND the merged fixture is captured', async (): Promise<void> =>
        capture(page, variant.name, '10-ai-fill-merged'));
    });
  }
});
