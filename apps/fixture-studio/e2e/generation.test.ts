import type { Download } from '@playwright/test';

import { expect, test } from './mocked-api.fixture.ts';
import { GENERATE_ROUTE } from './test/common/playwright.const.ts';
import type { StudioOptions } from './test/common/playwright.type.ts';
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
import { generateInvoiceAndCustomer } from './test/pages/workbench.page.ts';
import {
  copyDocument,
  expectClipboard,
  expectCode,
  expectDownload,
  expectEndpointTabs,
  expectFormatTabs,
  exportDocument,
  openEndpointTab,
  openFormatTab
} from './test/pages/workspace-step.page.ts';
import { CUSTOMER_ENDPOINT_STUB, INVOICE_ENDPOINT_STUB, INVOICE_FIXTURE_STUB } from './test/stubs/studio-api.stub.ts';
import { expectSentBodies } from './test/utils/recording-route.spec.util.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

const GENERATED_IDS = [INVOICE_ENDPOINT_STUB.id, CUSTOMER_ENDPOINT_STUB.id];

const INVOICE_JSON = INVOICE_FIXTURE_STUB.json ?? '';

const CLIPBOARD_PERMISSIONS = ['clipboard-read', 'clipboard-write'];

test.describe('FEATURE: fixture generation', () => {
  test('GIVEN the billing spec, generate is enabled only while an endpoint is selected', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND one endpoint is selected', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

    await test.step('THEN generate is enabled', async (): Promise<void> => expect(generateButton(page)).toBeEnabled());

    await test.step('WHEN the endpoint is unselected again', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

    await test.step('THEN generate is disabled', async (): Promise<void> => expect(generateButton(page)).toBeDisabled());
  });

  test('GIVEN the billing spec, generate is disabled without a format', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND one endpoint is selected', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

    await test.step('AND the JSON format is unchecked', async (): Promise<void> => toggleFormat(page, 'JSON fixture'));

    await test.step('AND the TS stub format is unchecked', async (): Promise<void> => toggleFormat(page, 'TS stub'));

    await test.step('THEN the options ask for a format', async (): Promise<void> =>
      expectFormatError(page, 'Pick at least one format.'));

    await test.step('AND generate is disabled', async (): Promise<void> => expect(generateButton(page)).toBeDisabled());
  });

  test('GIVEN the billing spec, required fields only is sent with the request', async ({ page }): Promise<void> => {
    const generation = generateMock();
    const routes = [apiRoute(GENERATE_ROUTE, generation)];
    const options: StudioOptions = { routes };
    const sentBody = { endpointIds: [INVOICE_ENDPOINT_STUB.id], formats: ['json', 'stub'], requiredOnly: true };

    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page, options));

    await test.step('AND one endpoint is selected', async (): Promise<void> => toggleEndpoint(page, INVOICE_ENDPOINT_STUB));

    await test.step('AND required fields only is switched on', async (): Promise<void> => toggleRequiredOnly(page));

    await test.step('AND generate is pressed', async (): Promise<void> => generate(page));

    await test.step('THEN the request asks for required fields only', async (): Promise<void> =>
      expectSentBodies(generation, [sentBody]));
  });

  test('GIVEN fixtures generated for two endpoints, each opens as a tab with a sub-tab per format', async ({
    page
  }): Promise<void> => {
    await test.step('WHEN the invoice and the customer are generated', async (): Promise<void> => generateInvoiceAndCustomer(page));

    await test.step('THEN the workspace has a tab per endpoint', async (): Promise<void> => expectEndpointTabs(page, GENERATED_IDS));

    await test.step('AND the first endpoint has JSON and TS stub tabs', async (): Promise<void> =>
      expectFormatTabs(page, ['JSON fixture', 'TS stub']));
  });

  test('GIVEN fixtures generated for two endpoints, the editor shows the chosen document', async ({ page }): Promise<void> => {
    await test.step('WHEN the invoice and the customer are generated', async (): Promise<void> => generateInvoiceAndCustomer(page));

    await test.step('AND the customer tab is opened', async (): Promise<void> => openEndpointTab(page, CUSTOMER_ENDPOINT_STUB.id));

    await test.step('AND its TS stub tab is opened', async (): Promise<void> => openFormatTab(page, 'TS stub'));

    await test.step('THEN the editor shows the customer stub', async (): Promise<void> =>
      expectCode(page, 'customer.stub.ts', 'export const CUSTOMER_STUB'));
  });

  test('GIVEN fixtures generated for two endpoints and clipboard access, copy puts the document on the clipboard', async ({
    page
  }): Promise<void> => {
    const options: StudioOptions = { permissions: CLIPBOARD_PERMISSIONS };

    await test.step('WHEN the invoice and the customer are generated', async (): Promise<void> =>
      generateInvoiceAndCustomer(page, options));

    await test.step('AND the invoice JSON is copied', async (): Promise<void> => copyDocument(page));

    await test.step('THEN the clipboard holds it', async (): Promise<void> => expectClipboard(page, INVOICE_JSON));
  });

  test('GIVEN fixtures generated for two endpoints, export downloads the document under its file name', async ({
    page
  }): Promise<void> => {
    await test.step('WHEN the invoice and the customer are generated', async (): Promise<void> => generateInvoiceAndCustomer(page));

    const download = await test.step('AND the invoice JSON is exported', async (): Promise<Download> => exportDocument(page));

    await test.step('THEN invoice.json holds the document', async (): Promise<void> =>
      expectDownload(download, 'invoice.json', INVOICE_JSON));
  });

  test('GIVEN fixtures generated for two endpoints, every interactive control has an accessible name', async ({
    page
  }): Promise<void> => {
    await test.step('WHEN the invoice and the customer are generated', async (): Promise<void> => generateInvoiceAndCustomer(page));

    await test.step('THEN the workspace has a tab per endpoint', async (): Promise<void> => expectEndpointTabs(page, GENERATED_IDS));

    await test.step('AND no control lacks a name', async (): Promise<void> => expectEveryControlNamed(page));
  });
});
