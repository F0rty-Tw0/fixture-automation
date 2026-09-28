import { test } from './studio.fixture.ts';
import { SAMPLE_PARTIAL_INVOICE_TS_PATH } from './test/common/fixture-file.const.ts';
import { SAMPLE_SPEC_PATH } from './test/common/playwright.const.ts';
import { expectLogLine, expectValidMerge, fillMissingValues } from './test/pages/ai-fill-panel.page.ts';
import { pickExistingFixture } from './test/pages/compare-panel.page.ts';
import { generate, toggleEndpoint } from './test/pages/endpoints-step.page.ts';
import { continueToAiFill, expectMissingPaths } from './test/pages/missing-values-step.page.ts';
import { expectSpecLoaded, loadSpecFromFile, openStudio } from './test/pages/spec-step.page.ts';
import { generateSampleInvoice } from './test/pages/workbench.page.ts';
import { expectCode, expectEndpointTabs } from './test/pages/workspace-step.page.ts';
import { SAMPLE_INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';

/** What the real diff reports for `sample-partial-invoice.fixture.ts` against the sample spec's invoice. */
const LIVE_MISSING_PATHS = ['memo', 'customer'];

test.describe('FEATURE: live studio', () => {
  test.describe('GIVEN the real API runs with mocked AI', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the studio is open', async (): Promise<void> => openStudio(page));
    });

    test('SCENARIO: the sample spec file generates a real invoice fixture', async ({ page }): Promise<void> => {
      await test.step('WHEN the sample spec file is picked', async (): Promise<void> => loadSpecFromFile(page, SAMPLE_SPEC_PATH));

      await test.step('THEN the API parsed the spec', async (): Promise<void> => expectSpecLoaded(page, 'Studio API'));

      await test.step('AND the invoice endpoint is selected', async (): Promise<void> =>
        toggleEndpoint(page, SAMPLE_INVOICE_ENDPOINT_STUB));

      await test.step('AND generate is pressed', async (): Promise<void> => generate(page));

      await test.step('THEN the workspace has the invoice tab', async (): Promise<void> =>
        expectEndpointTabs(page, [SAMPLE_INVOICE_ENDPOINT_STUB.id]));

      await test.step('AND the editor shows the sampled invoice', async (): Promise<void> =>
        expectCode(page, 'invoice.json', '"id": "in_123"'));
    });

    test('SCENARIO: a partial .ts fixture is compared, filled by the mock CLI and merged valid', async ({ page }): Promise<void> => {
      await test.step('GIVEN the sample invoice fixture is generated', async (): Promise<void> => generateSampleInvoice(page));

      await test.step('WHEN the partial invoice .ts is picked', async (): Promise<void> =>
        pickExistingFixture(page, SAMPLE_PARTIAL_INVOICE_TS_PATH));

      await test.step('THEN the API lists the missing paths', async (): Promise<void> => expectMissingPaths(page, LIVE_MISSING_PATHS));

      await test.step('AND the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

      await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the mock CLI progress is logged', async (): Promise<void> => expectLogLine(page, 'mock: done'));

      await test.step('AND the merge is valid', async (): Promise<void> => expectValidMerge(page, LIVE_MISSING_PATHS.length));
    });
  });
});
