import { test } from './mocked-api.fixture.ts';
import { PARTIAL_INVOICE_JSON_PATH } from './test/common/fixture-file.const.ts';
import { pickExistingFixture } from './test/pages/compare-panel.page.ts';
import { expectFoldOpen, toggleFold } from './test/pages/fold.page.ts';
import { continueToAiFill } from './test/pages/missing-values-step.page.ts';
import { STEP_HEADINGS, expectStepFold, expectToggleAt, toggleLeft, toggleStep } from './test/pages/rail.page.ts';
import { fillBrokenInvoice, openInvoiceCompare, workbenchRoutes } from './test/pages/workbench.page.ts';

type FoldCase = {
  readonly step: string;
  readonly summary: string;
  readonly isOpen: boolean;
};

/** Every folding section inside a step, and whether it starts open, once the invoice is compared, filled and merged. */
const FOLD_CASES: FoldCase[] = [
  { step: 'Compare', summary: 'Your fixture beside the schema-complete one', isOpen: true },
  { step: 'Missing & broken values', summary: 'Missing paths', isOpen: true },
  { step: 'Missing & broken values', summary: 'customer', isOpen: true },
  { step: 'Missing & broken values', summary: 'Broken values', isOpen: true },
  { step: 'Fill with AI', summary: 'Model output', isOpen: true },
  { step: 'Fill with AI', summary: 'Where each value came from', isOpen: true },
  { step: 'Fill with AI', summary: 'Merged fixture', isOpen: true },
  { step: 'Fill with AI', summary: 'Filled values', isOpen: false }
];

test.describe('FEATURE: folding steps and sections', () => {
  for (const heading of STEP_HEADINGS) {
    test(`GIVEN a generated invoice, the ${heading} toggle folds the body it controls and opens it again`, async ({
      page
    }): Promise<void> => {
      await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page));

      await test.step('THEN the step is open', async (): Promise<void> => expectStepFold(page, heading, true));

      const openLeft = await toggleLeft(page, heading);

      await test.step('WHEN its heading is pressed', async (): Promise<void> => toggleStep(page, heading));

      await test.step('THEN the step and its body are folded', async (): Promise<void> => expectStepFold(page, heading, false));

      await test.step('AND its heading and chevron stay on the rail', async (): Promise<void> =>
        expectToggleAt(page, heading, openLeft));

      await test.step('WHEN its heading is pressed again', async (): Promise<void> => toggleStep(page, heading));

      await test.step('THEN the step and its body are open again', async (): Promise<void> => expectStepFold(page, heading, true));
    });
  }

  test('GIVEN a folded step that waits, it opens itself when it becomes the active one', async ({ page }): Promise<void> => {
    const routes = workbenchRoutes();

    await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page, { routes }));

    await test.step('AND the waiting Missing & broken values step is folded', async (): Promise<void> =>
      toggleStep(page, 'Missing & broken values'));

    await test.step('THEN it is folded', async (): Promise<void> => expectStepFold(page, 'Missing & broken values', false));

    await test.step('WHEN the partial invoice is picked', async (): Promise<void> =>
      pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

    await test.step('THEN the now active step opened itself', async (): Promise<void> =>
      expectStepFold(page, 'Missing & broken values', true));
  });

  test('GIVEN steps the user folded, they stay folded until they become active again', async ({ page }): Promise<void> => {
    const routes = workbenchRoutes();

    await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page, { routes }));

    await test.step('AND the done Generate step is folded', async (): Promise<void> => toggleStep(page, 'Generate'));

    await test.step('AND the waiting Fill with AI step is folded', async (): Promise<void> => toggleStep(page, 'Fill with AI'));

    await test.step('AND the partial invoice is picked', async (): Promise<void> =>
      pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

    await test.step('THEN Generate stays folded', async (): Promise<void> => expectStepFold(page, 'Generate', false));

    await test.step('AND Fill with AI, still waiting, stays folded', async (): Promise<void> =>
      expectStepFold(page, 'Fill with AI', false));

    await test.step('WHEN the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

    await test.step('THEN Fill with AI, now active, opened itself', async (): Promise<void> =>
      expectStepFold(page, 'Fill with AI', true));

    await test.step('AND Generate is still folded', async (): Promise<void> => expectStepFold(page, 'Generate', false));
  });

  for (const fold of FOLD_CASES) {
    test(`GIVEN a filled and merged invoice, the "${fold.summary}" section of ${fold.step} folds and opens`, async ({
      page
    }): Promise<void> => {
      await test.step('WHEN the invoice with a broken value is compared, filled and merged', async (): Promise<void> =>
        fillBrokenInvoice(page));

      await test.step('THEN the section starts as it should', async (): Promise<void> =>
        expectFoldOpen(page, fold.step, fold.summary, fold.isOpen));

      await test.step('WHEN its summary is pressed', async (): Promise<void> => toggleFold(page, fold.step, fold.summary));

      await test.step('THEN it flips', async (): Promise<void> => expectFoldOpen(page, fold.step, fold.summary, !fold.isOpen));

      await test.step('WHEN its summary is pressed again', async (): Promise<void> => toggleFold(page, fold.step, fold.summary));

      await test.step('THEN it is back as it started', async (): Promise<void> =>
        expectFoldOpen(page, fold.step, fold.summary, fold.isOpen));
    });
  }
});
