import { expect, test } from './mocked-api.fixture.ts';
import {
  endpointCheckbox,
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
  test.describe('GIVEN the billing spec is loaded', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the studio shows the billing spec', async (): Promise<unknown> => openStudioWithSpec(page));
    });

    test('SCENARIO: the query filter keeps endpoints whose path or summary matches', async ({ page }): Promise<void> => {
      await test.step('WHEN the list is filtered by "invoice"', async (): Promise<void> => filterByQuery(page, 'invoice'));

      await test.step('THEN only invoice endpoints remain', async (): Promise<void> =>
        expectVisibleEndpoints(page, [INVOICE_ENDPOINT_STUB, INVOICE_CREATE_ENDPOINT_STUB]));
    });

    test('SCENARIO: the tag filter keeps one tag group', async ({ page }): Promise<void> => {
      await test.step('WHEN the Customers tag is chosen', async (): Promise<void> => filterByTag(page, 'Customers'));

      await test.step('THEN only the customer endpoint remains', async (): Promise<void> =>
        expectVisibleEndpoints(page, [CUSTOMER_ENDPOINT_STUB]));
    });

    test('SCENARIO: the method filter keeps one HTTP method', async ({ page }): Promise<void> => {
      await test.step('WHEN the POST method is chosen', async (): Promise<void> => filterByMethod(page, 'POST'));

      await test.step('THEN only the POST endpoint remains', async (): Promise<void> =>
        expectVisibleEndpoints(page, [INVOICE_CREATE_ENDPOINT_STUB]));
    });

    test('SCENARIO: an endpoint without a JSON schema is disabled with its reason', async ({ page }): Promise<void> => {
      await test.step('WHEN the Reports tag is chosen', async (): Promise<void> => filterByTag(page, 'Reports'));

      await test.step('THEN the report endpoint cannot be selected', async (): Promise<void> =>
        expectUnsupported(page, REPORT_ENDPOINT_STUB));
    });

    test('SCENARIO: select all visible selects every supported endpoint', async ({ page }): Promise<void> => {
      await test.step('WHEN every visible endpoint is selected', async (): Promise<void> => selectAllVisible(page));

      await test.step('THEN the three supported endpoints are counted', async (): Promise<void> =>
        expectSelectionSummary(page, '3 selected · 4 of 4 shown'));

      await test.step('AND the unsupported one stays unchecked', async (): Promise<void> =>
        expect(endpointCheckbox(page, REPORT_ENDPOINT_STUB)).not.toBeChecked());
    });

    test('SCENARIO: select all visible leaves filtered-out endpoints alone', async ({ page }): Promise<void> => {
      await test.step('WHEN the list is filtered to invoices', async (): Promise<void> => filterByTag(page, 'Invoices'));

      await test.step('AND every visible endpoint is selected', async (): Promise<void> => selectAllVisible(page));

      await test.step('THEN only the two invoice endpoints are counted', async (): Promise<void> =>
        expectSelectionSummary(page, '2 selected · 2 of 4 shown'));
    });

    test('SCENARIO: the keyboard moves through the list and space toggles a row', async ({ page }): Promise<void> => {
      await test.step('GIVEN focus is on select all', async (): Promise<void> => focusOn(selectAllCheckbox(page)));

      await test.step('WHEN Tab is pressed', async (): Promise<void> => pressKey(page, 'Tab'));

      await test.step('THEN the first endpoint has focus', async (): Promise<void> =>
        expect(endpointCheckbox(page, INVOICE_ENDPOINT_STUB)).toBeFocused());

      await test.step('AND Space is pressed', async (): Promise<void> => pressKey(page, 'Space'));

      await test.step('THEN the first endpoint is checked', async (): Promise<void> =>
        expect(endpointCheckbox(page, INVOICE_ENDPOINT_STUB)).toBeChecked());

      await test.step('AND Tab is pressed again', async (): Promise<void> => pressKey(page, 'Tab'));

      await test.step('THEN the second endpoint has focus', async (): Promise<void> =>
        expect(endpointCheckbox(page, INVOICE_CREATE_ENDPOINT_STUB)).toBeFocused());
    });
  });
});
