import { test } from './mocked-api.fixture.ts';
import { PARTIAL_INVOICE_JSON_PATH } from './test/common/fixture-file.const.ts';
import { DIFF_ROUTE } from './test/common/playwright.const.ts';
import { diffMock } from './test/mocks/workbench.mock.ts';
import { pickExistingFixture } from './test/pages/compare-panel.page.ts';
import { expectListsScrollInside } from './test/pages/missing-values-step.page.ts';
import { expectPageHeightWithin, expectStepStatus } from './test/pages/rail.page.ts';
import { openInvoiceCompare } from './test/pages/workbench.page.ts';
import { longDiff } from './test/utils/long-diff.spec.util.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

const LONG_DIFF = longDiff(2000, 500);

test.describe('FEATURE: long missing and broken lists', () => {
  test('GIVEN 2000 missing paths and 500 broken values, both lists scroll inside and the page stays short', async ({
    page
  }): Promise<void> => {
    const routes = [apiRoute(DIFF_ROUTE, diffMock(LONG_DIFF))];

    await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page, routes));

    await test.step('AND the partial invoice is picked', async (): Promise<void> => pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

    await test.step('THEN the step counts every missing and broken value', async (): Promise<void> =>
      expectStepStatus(page, 'Missing & broken values', '2000 missing · 500 broken'));

    await test.step('AND both lists scroll inside their own box', async (): Promise<void> => expectListsScrollInside(page));

    await test.step('AND the page stays within six screens', async (): Promise<void> => expectPageHeightWithin(page, 6));
  });
});
