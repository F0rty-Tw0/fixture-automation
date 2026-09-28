import { test } from './mocked-api.fixture.ts';
import { PARTIAL_INVOICE_JSON_PATH } from './test/common/fixture-file.const.ts';
import { expectAiFillOpen, expectAiFillWaiting, expectValidMerge, fillMissingValues } from './test/pages/ai-fill-panel.page.ts';
import { expectChangeLabel, nextChange, pickExistingFixture } from './test/pages/compare-panel.page.ts';
import { continueToAiFill, expectMissingPaths } from './test/pages/missing-values-step.page.ts';
import { STEP_HEADINGS, expectStepBodyShown, expectStepExpanded, expectSteps, toggleStep } from './test/pages/rail.page.ts';
import { openInvoiceCompare, routeWorkbenchApi } from './test/pages/workbench.page.ts';
import { DIFF_RESULT_STUB } from './test/stubs/workbench.stub.ts';

const FILLED_COUNT = DIFF_RESULT_STUB.missingPaths.length;

test.describe('FEATURE: the studio rail', () => {
  test.describe('GIVEN the invoice is generated and every workbench call is answered', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the workbench API answers every call', async (): Promise<void> => routeWorkbenchApi(page));

      await test.step('AND the invoice is generated', async (): Promise<void> => openInvoiceCompare(page));
    });

    test('GIVEN a partial invoice, the six steps run in order, one after the other', async ({ page }): Promise<void> => {
      await test.step('THEN the rail shows the six steps', async (): Promise<void> => expectSteps(page, STEP_HEADINGS));

      await test.step('AND AI fill waits', async (): Promise<void> => expectAiFillWaiting(page));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the missing values show before any AI runs', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND AI fill still waits', async (): Promise<void> => expectAiFillWaiting(page));

      await test.step('WHEN the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

      await test.step('THEN AI fill opens', async (): Promise<void> => expectAiFillOpen(page));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));
    });

    test('GIVEN any step, its heading folds it away and opens it again', async ({ page }): Promise<void> => {
      await test.step('THEN the Generate step is open, its JSON fixture section shown', async (): Promise<void> =>
        expectStepBodyShown(page, 'Generate', 'JSON fixture', true));

      await test.step('WHEN the Generate heading is pressed', async (): Promise<void> => toggleStep(page, 'Generate'));

      await test.step('THEN the step is folded', async (): Promise<void> => expectStepExpanded(page, 'Generate', false));

      await test.step('AND its documents are hidden', async (): Promise<void> =>
        expectStepBodyShown(page, 'Generate', 'JSON fixture', false));

      await test.step('WHEN the Generate heading is pressed again', async (): Promise<void> => toggleStep(page, 'Generate'));

      await test.step('THEN the step is open again', async (): Promise<void> => expectStepExpanded(page, 'Generate', true));
    });

    test('GIVEN a compared invoice, the change map walks through the changes', async ({ page }): Promise<void> => {
      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the change map counts one change', async (): Promise<void> => expectChangeLabel(page, '1 change'));

      await test.step('WHEN the next change is asked for', async (): Promise<void> => nextChange(page));

      await test.step('THEN it names the change and its line', async (): Promise<void> =>
        expectChangeLabel(page, 'Change 1 of 1, line 4'));
    });
  });
});
