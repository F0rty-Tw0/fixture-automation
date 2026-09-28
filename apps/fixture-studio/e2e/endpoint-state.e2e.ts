import { expect, test } from './mocked-api.fixture.ts';
import { PARTIAL_INVOICE_JSON_PATH } from './test/common/fixture-file.const.ts';
import { diffByEndpointMock } from './test/mocks/workbench.mock.ts';
import { expectComparing, pasteFixture, pickExistingFixture, switchCompareEndpoint } from './test/pages/compare-panel.page.ts';
import { expectBrokenValues, expectMissingPaths } from './test/pages/missing-values-step.page.ts';
import { expectStepStatus } from './test/pages/rail.page.ts';
import { openTwoEndpointCompare } from './test/pages/workbench.page.ts';
import { openEndpointTab } from './test/pages/workspace-step.page.ts';
import { CUSTOMER_DIFF_RESULT_STUB, PARTIAL_CUSTOMER_STUB } from './test/stubs/endpoint-state.stub.ts';
import { CUSTOMER_ENDPOINT_STUB, INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import { BROKEN_AMOUNT_STUB, DIFF_RESULT_STUB } from './test/stubs/workbench.stub.ts';

const MISSING = 'Missing & broken values';

/** The broken invoice: three absent paths, and `amount_due` replaced as broken. */
const INVOICE_MISSING_STATUS = '3 missing · 1 broken';

const CUSTOMER_JSON = JSON.stringify(PARTIAL_CUSTOMER_STUB);

const INVOICE_COMPARE = { endpointId: INVOICE_ENDPOINT_STUB.id };

const CUSTOMER_COMPARE = { endpointId: CUSTOMER_ENDPOINT_STUB.id };

test.describe('FEATURE: per-endpoint compare state', () => {
  test('GIVEN two generated endpoints, switching in Compare keeps each endpoint its own diff', async ({ page }): Promise<void> => {
    const diff = diffByEndpointMock();
    const onePerEndpoint = [expect.objectContaining(INVOICE_COMPARE), expect.objectContaining(CUSTOMER_COMPARE)];

    await test.step('WHEN the invoice and the customer are generated', async (): Promise<void> => openTwoEndpointCompare(page, diff));

    await test.step('THEN Compare is for the invoice', async (): Promise<void> => expectStepStatus(page, 'Compare', INVOICE_ENDPOINT_STUB.id));

    await test.step('WHEN the partial invoice is picked', async (): Promise<void> => pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

    await test.step('THEN its missing paths are listed', async (): Promise<void> =>
      expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

    await test.step('AND its broken value is listed', async (): Promise<void> => expectBrokenValues(page, [BROKEN_AMOUNT_STUB.path]));

    await test.step('WHEN Compare switches to the customer', async (): Promise<void> =>
      switchCompareEndpoint(page, CUSTOMER_ENDPOINT_STUB.id));

    await test.step('THEN Compare is for the customer', async (): Promise<void> =>
      expectStepStatus(page, 'Compare', CUSTOMER_ENDPOINT_STUB.id));

    await test.step('AND its missing values wait for a compare', async (): Promise<void> =>
      expectStepStatus(page, MISSING, 'Waiting for a compare'));

    await test.step('WHEN a partial customer is pasted', async (): Promise<void> => pasteFixture(page, CUSTOMER_JSON));

    await test.step('THEN the customer missing paths are listed', async (): Promise<void> =>
      expectMissingPaths(page, CUSTOMER_DIFF_RESULT_STUB.missingPaths));

    await test.step('WHEN Compare switches back to the invoice', async (): Promise<void> =>
      switchCompareEndpoint(page, INVOICE_ENDPOINT_STUB.id));

    await test.step('THEN Compare is for the invoice again', async (): Promise<void> =>
      expectStepStatus(page, 'Compare', INVOICE_ENDPOINT_STUB.id));

    await test.step('AND it still compares the picked file', async (): Promise<void> => expectComparing(page, 'partial-invoice.json'));

    await test.step('AND the invoice missing paths are back', async (): Promise<void> =>
      expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

    await test.step('AND its broken value is back', async (): Promise<void> => expectBrokenValues(page, [BROKEN_AMOUNT_STUB.path]));

    await test.step('AND its counts are back', async (): Promise<void> => expectStepStatus(page, MISSING, INVOICE_MISSING_STATUS));

    await test.step('AND each endpoint was diffed once, switching sent nothing', (): void =>
      expect(diff.bodies).toEqual(onePerEndpoint));
  });

  test('GIVEN two generated endpoints, switching Generate tabs keeps each endpoint its own diff', async ({ page }): Promise<void> => {
    const diff = diffByEndpointMock();

    await test.step('WHEN the invoice and the customer are generated', async (): Promise<void> => openTwoEndpointCompare(page, diff));

    await test.step('AND the partial invoice is picked', async (): Promise<void> => pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

    await test.step('THEN its missing paths are listed', async (): Promise<void> =>
      expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

    await test.step('WHEN the customer tab is opened in Generate', async (): Promise<void> =>
      openEndpointTab(page, CUSTOMER_ENDPOINT_STUB.id));

    await test.step('THEN Compare follows it to the customer', async (): Promise<void> =>
      expectStepStatus(page, 'Compare', CUSTOMER_ENDPOINT_STUB.id));

    await test.step('AND its missing values wait for a compare', async (): Promise<void> =>
      expectStepStatus(page, MISSING, 'Waiting for a compare'));

    await test.step('WHEN the invoice tab is opened again', async (): Promise<void> => openEndpointTab(page, INVOICE_ENDPOINT_STUB.id));

    await test.step('THEN Compare follows it back to the invoice', async (): Promise<void> =>
      expectStepStatus(page, 'Compare', INVOICE_ENDPOINT_STUB.id));

    await test.step('AND the invoice missing paths are still listed', async (): Promise<void> =>
      expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

    await test.step('AND its counts are still shown', async (): Promise<void> => expectStepStatus(page, MISSING, INVOICE_MISSING_STATUS));
  });
});
