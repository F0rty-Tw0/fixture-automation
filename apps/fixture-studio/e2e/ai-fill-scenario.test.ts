import { expect, test } from './mocked-api.fixture.ts';
import { AI_FILL_ROUTE, MERGE_ROUTE } from './test/common/playwright.const.ts';
import type { AiFillOptions } from './test/common/playwright.type.ts';
import { aiFillMock, mergeMock } from './test/mocks/workbench.mock.ts';
import { typeExtraPrompt } from './test/pages/ai-fill-form.page.ts';
import { expectValidMerge, fillMissingValues } from './test/pages/ai-fill-panel.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import { INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import { MISSING_FILE_STUB, PARTIAL_INVOICE_STUB } from './test/stubs/workbench.stub.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

const SCENARIO = 'an overdue invoice for a German customer';

const SENT_FILL = {
  endpointId: INVOICE_ENDPOINT_STUB.id,
  fixture: PARTIAL_INVOICE_STUB,
  missing: MISSING_FILE_STUB,
  tool: 'claude',
  scenario: SCENARIO
};

test.describe('FEATURE: the extra prompt', () => {
  test('GIVEN a typed extra prompt, the CLI fill request carries it as the scenario', async ({ page }): Promise<void> => {
    const fill = aiFillMock();
    const routes = [apiRoute(AI_FILL_ROUTE, fill), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND an extra prompt is typed', async (): Promise<void> => typeExtraPrompt(page, SCENARIO));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, MISSING_FILE_STUB.paths.length));

    await test.step('AND the fill request sent the extra prompt as its scenario', (): void =>
      expect(fill.bodies).toEqual([SENT_FILL]));
  });
});
