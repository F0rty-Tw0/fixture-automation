import type { Download } from '@playwright/test';

import { expect, test } from './mocked-api.fixture.ts';
import { GENERATE_ROUTE } from './test/common/playwright.const.ts';
import { generateMock } from './test/mocks/studio-api.mock.ts';
import {
  expectFormatError,
  generate,
  generateButton,
  toggleEndpoint,
  toggleFormat,
  toggleRequiredOnly
} from './test/pages/endpoints-step.page.ts';
import { expectEveryControlNamed, openStudioWithSpec } from './test/pages/studio.page.ts';
import {
  copyDocument,
  expectClipboard,
  expectCode,
  expectDocuments,
  expectDownload,
  expectEndpointTabs,
  exportDocument,
  openDocument,
  openEndpointTab
} from './test/pages/workspace-step.page.ts';
import { CUSTOMER_ENDPOINT_STUB, INVOICE_ENDPOINT_STUB, INVOICE_FIXTURE_STUB } from './test/stubs/studio-api.stub.ts';
import { routeApi } from './test/utils/route.spec.util.ts';

const GENERATED_IDS = [INVOICE_ENDPOINT_STUB.id, CUSTOMER_ENDPOINT_STUB.id];

const INVOICE_JSON = INVOICE_FIXTURE_STUB.json ?? '';

test.describe('FEATURE: fixture generation', () => {
  test.describe('GIVEN the billing spec is loaded', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the studio shows the billing spec', async (): Promise<unknown> => openStudioWithSpec(page));
    });

    test('SCENARIO: generate is enabled only while an endpoint is selected', async ({ page }): Promise<void> => {
      await test.step('WHEN one endpoint is selected', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

      await test.step('THEN generate is enabled', async (): Promise<void> => expect(generateButton(page)).toBeEnabled());

      await test.step('AND the endpoint is unselected again', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

      await test.step('THEN generate is disabled', async (): Promise<void> => expect(generateButton(page)).toBeDisabled());
    });

    test('SCENARIO: generate is disabled without a format', async ({ page }): Promise<void> => {
      await test.step('GIVEN one endpoint is selected', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

      await test.step('WHEN the JSON format is unchecked', async (): Promise<void> => toggleFormat(page, 'JSON fixture'));

      await test.step('AND the TS stub format is unchecked', async (): Promise<void> => toggleFormat(page, 'TS stub'));

      await test.step('THEN the options ask for a format', async (): Promise<void> =>
        expectFormatError(page, 'Pick at least one format.'));

      await test.step('AND generate is disabled', async (): Promise<void> => expect(generateButton(page)).toBeDisabled());
    });

    test('SCENARIO: required fields only is sent with the request', async ({ page }): Promise<void> => {
      const generation = generateMock();
      const sentBody = { endpointIds: [INVOICE_ENDPOINT_STUB.id], formats: ['json', 'stub'], requiredOnly: true };
      const sentBodies = (): unknown[] => generation.bodies;

      await test.step('GIVEN the API generates fixtures', async (): Promise<void> =>
        routeApi(page, GENERATE_ROUTE, generation.handler));

      await test.step('AND one endpoint is selected', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

      await test.step('WHEN required fields only is switched on', async (): Promise<void> => toggleRequiredOnly(page));

      await test.step('AND generate is pressed', async (): Promise<void> => generate(page));

      await test.step('THEN the request asks for required fields only', async (): Promise<void> =>
        expect.poll(sentBodies).toEqual([sentBody]));
    });
  });

  test.describe('GIVEN fixtures were generated for two endpoints', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the studio shows the billing spec', async (): Promise<unknown> => openStudioWithSpec(page));

      await test.step('AND the API generates fixtures', async (): Promise<void> =>
        routeApi(page, GENERATE_ROUTE, generateMock().handler));

      await test.step('AND the invoice endpoint is selected', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

      await test.step('AND the customer endpoint is selected', async (): Promise<void> =>
        toggleEndpoint(page, CUSTOMER_ENDPOINT_STUB));

      await test.step('AND generate is pressed', async (): Promise<void> => generate(page));
    });

    test('SCENARIO: each endpoint opens as a tab with a folding section per format', async ({ page }): Promise<void> => {
      await test.step('WHEN the workspace shows the result', async (): Promise<void> => expectEndpointTabs(page, GENERATED_IDS));

      await test.step('THEN the first endpoint has JSON and TS stub sections', async (): Promise<void> =>
        expectDocuments(page, ['JSON fixture', 'TS stub']));
    });

    test('SCENARIO: the editor shows the chosen document', async ({ page }): Promise<void> => {
      await test.step('WHEN the customer tab is opened', async (): Promise<void> => openEndpointTab(page, CUSTOMER_ENDPOINT_STUB.id));

      await test.step('AND its TS stub section is opened', async (): Promise<void> => openDocument(page, 'TS stub'));

      await test.step('THEN the editor shows the customer stub', async (): Promise<void> =>
        expectCode(page, 'customer.stub.ts', 'export const CUSTOMER_STUB'));
    });

    test('SCENARIO: copy puts the document on the clipboard', async ({ page }): Promise<void> => {
      await test.step('WHEN the invoice JSON is copied', async (): Promise<void> => copyDocument(page));

      await test.step('THEN the clipboard holds it', async (): Promise<void> => expectClipboard(page, INVOICE_JSON));
    });

    test('SCENARIO: export downloads the document under its file name', async ({ page }): Promise<void> => {
      const download = await test.step('WHEN the invoice JSON is exported', async (): Promise<Download> => exportDocument(page));

      await test.step('THEN invoice.json holds the document', async (): Promise<void> =>
        expectDownload(download, 'invoice.json', INVOICE_JSON));
    });

    test('SCENARIO: every interactive control has an accessible name', async ({ page }): Promise<void> => {
      await test.step('WHEN the workspace shows the result', async (): Promise<void> => expectEndpointTabs(page, GENERATED_IDS));

      await test.step('THEN no control lacks a name', async (): Promise<void> => expectEveryControlNamed(page));
    });
  });
});
