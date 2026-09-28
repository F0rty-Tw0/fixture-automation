import { test } from './mocked-api.fixture.ts';
import {
  expectEndpointChecked,
  expectEndpointFocused,
  expectSelectionSummary,
  expectUnsupported,
  expectVisibleEndpoints,
  filterByMethod,
  filterByQuery,
  filterByTag,
  selectAllCheckbox,
  selectAllVisible
} from './test/pages/endpoints-step.page.ts';
import { openStudioWithSpec } from './test/pages/studio.page.ts';
import {
  CUSTOMER_ENDPOINT_STUB,
  INVOICE_CREATE_ENDPOINT_STUB,
  INVOICE_ENDPOINT_STUB,
  REPORT_ENDPOINT_STUB
} from './test/stubs/studio-api.stub.ts';
import { focusOn, pressKey } from './test/utils/keyboard.spec.util.ts';

test.describe('FEATURE: endpoint browser', () => {
  test('GIVEN the billing spec, the query filter keeps endpoints whose path or summary matches', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND the list is filtered by "invoice"', async (): Promise<void> => filterByQuery(page, 'invoice'));

    await test.step('THEN only invoice endpoints remain', async (): Promise<void> =>
      expectVisibleEndpoints(page, [INVOICE_ENDPOINT_STUB, INVOICE_CREATE_ENDPOINT_STUB]));
  });

  test('GIVEN the billing spec, the tag filter keeps one tag group', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND the Customers tag is chosen', async (): Promise<void> => filterByTag(page, 'Customers'));

    await test.step('THEN only the customer endpoint remains', async (): Promise<void> =>
      expectVisibleEndpoints(page, [CUSTOMER_ENDPOINT_STUB]));
  });

  test('GIVEN the billing spec, the method filter keeps one HTTP method', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND the POST method is chosen', async (): Promise<void> => filterByMethod(page, 'POST'));

    await test.step('THEN only the POST endpoint remains', async (): Promise<void> =>
      expectVisibleEndpoints(page, [INVOICE_CREATE_ENDPOINT_STUB]));
  });

  test('GIVEN the billing spec, an endpoint without a JSON schema is disabled with its reason', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND the Reports tag is chosen', async (): Promise<void> => filterByTag(page, 'Reports'));

    await test.step('THEN the report endpoint cannot be selected', async (): Promise<void> =>
      expectUnsupported(page, REPORT_ENDPOINT_STUB));
  });

  test('GIVEN the billing spec, select all visible selects every supported endpoint', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND every visible endpoint is selected', async (): Promise<void> => selectAllVisible(page));

    await test.step('THEN the three supported endpoints are counted', async (): Promise<void> =>
      expectSelectionSummary(page, '3 selected · 4 of 4 shown'));

    await test.step('AND the unsupported one stays unchecked', async (): Promise<void> =>
      expectEndpointChecked(page, REPORT_ENDPOINT_STUB, false));
  });

  test('GIVEN the billing spec, select all visible leaves filtered-out endpoints alone', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND the list is filtered to invoices', async (): Promise<void> => filterByTag(page, 'Invoices'));

    await test.step('AND every visible endpoint is selected', async (): Promise<void> => selectAllVisible(page));

    await test.step('THEN only the two invoice endpoints are counted', async (): Promise<void> =>
      expectSelectionSummary(page, '2 selected · 2 of 4 shown'));
  });

  test('GIVEN the billing spec, the keyboard moves through the list and space toggles a row', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudioWithSpec(page));

    await test.step('AND focus is on select all', async (): Promise<void> => focusOn(selectAllCheckbox(page)));

    await test.step('AND Tab is pressed', async (): Promise<void> => pressKey(page, 'Tab'));

    await test.step('THEN the first endpoint has focus', async (): Promise<void> =>
      expectEndpointFocused(page, INVOICE_ENDPOINT_STUB));

    await test.step('WHEN Space is pressed', async (): Promise<void> => pressKey(page, 'Space'));

    await test.step('THEN the first endpoint is checked', async (): Promise<void> =>
      expectEndpointChecked(page, INVOICE_ENDPOINT_STUB, true));

    await test.step('WHEN Tab is pressed again', async (): Promise<void> => pressKey(page, 'Tab'));

    await test.step('THEN the second endpoint has focus', async (): Promise<void> =>
      expectEndpointFocused(page, INVOICE_CREATE_ENDPOINT_STUB));
  });
});
