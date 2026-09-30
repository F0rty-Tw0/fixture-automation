import type { DiffResult } from '@fixture-automation/fixture-studio-api/contract';

import { test } from './mocked-api.fixture.ts';
import { DIFF_ROUTE } from './test/common/playwright.const.ts';
import { diffMock } from './test/mocks/workbench.mock.ts';
import {
  clickChangeMapEnd,
  expectChangeLabel,
  expectLineInView,
  expectLineOutOfView,
  nextChange,
  pasteFixture,
  previousChange,
  scrollToChangeMap
} from './test/pages/compare-panel.page.ts';
import { openInvoiceCompare } from './test/pages/workbench.page.ts';
import { DIFF_RESULT_STUB } from './test/stubs/workbench.stub.ts';
import { longCompleteJson, longFixtureJson } from './test/utils/change-map.spec.util.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

const LINE_COUNT = 300;

/** Three insertions far apart: near the top, in the middle, and near the end of a 300-line fixture. */
const ADDED = new Map<string, [string, string]>([
  ['line_009', ['added_top', 'first']],
  ['line_149', ['added_middle', 'second']],
  ['line_289', ['added_end', 'third']]
]);

const COMPLETE_FILE = 'invoice.complete.json';

const LONG_DIFF: DiffResult = { ...DIFF_RESULT_STUB, completeJson: longCompleteJson(LINE_COUNT, ADDED) };

const FIXTURE_JSON = longFixtureJson(LINE_COUNT);

test.describe('FEATURE: the change map beside a diff', () => {
  test('GIVEN three changes far apart, next and previous walk through them in order', async ({ page }): Promise<void> => {
    const routes = [apiRoute(DIFF_ROUTE, diffMock(LONG_DIFF))];

    await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page, { routes }));

    await test.step('AND a 300-line fixture is pasted', async (): Promise<void> => pasteFixture(page, FIXTURE_JSON));

    await test.step('THEN the map counts three changes', async (): Promise<void> => expectChangeLabel(page, '3 changes'));

    await test.step('WHEN the next change is asked for', async (): Promise<void> => nextChange(page));

    await test.step('THEN it is the first, near the top', async (): Promise<void> =>
      expectChangeLabel(page, 'Change 1 of 3, line 12'));

    await test.step('WHEN the next change is asked for again', async (): Promise<void> => nextChange(page));

    await test.step('THEN it is the second, in the middle', async (): Promise<void> =>
      expectChangeLabel(page, 'Change 2 of 3, line 153'));

    await test.step('WHEN the next change is asked for a third time', async (): Promise<void> => nextChange(page));

    await test.step('THEN it is the third, near the end', async (): Promise<void> =>
      expectChangeLabel(page, 'Change 3 of 3, line 294'));

    await test.step('AND the editor scrolled to it', async (): Promise<void> => expectLineInView(page, COMPLETE_FILE, '"added_end"'));

    await test.step('WHEN the previous change is asked for', async (): Promise<void> => previousChange(page));

    await test.step('THEN it is the second again', async (): Promise<void> => expectChangeLabel(page, 'Change 2 of 3, line 153'));
  });

  test('GIVEN three changes far apart, clicking the end of the map scrolls the last change into view', async ({
    page
  }): Promise<void> => {
    const routes = [apiRoute(DIFF_ROUTE, diffMock(LONG_DIFF))];

    await test.step('WHEN the invoice is generated', async (): Promise<void> => openInvoiceCompare(page, { routes }));

    await test.step('AND a 300-line fixture is pasted', async (): Promise<void> => pasteFixture(page, FIXTURE_JSON));

    await test.step('AND the diff is scrolled into the page', async (): Promise<void> => scrollToChangeMap(page));

    await test.step('THEN the first change is in view', async (): Promise<void> =>
      expectLineInView(page, COMPLETE_FILE, '"added_top"'));

    await test.step('AND the last change is out of view', async (): Promise<void> =>
      expectLineOutOfView(page, COMPLETE_FILE, '"added_end"'));

    await test.step('WHEN the bottom of the change map is clicked', async (): Promise<void> => clickChangeMapEnd(page));

    await test.step('THEN the last change is picked', async (): Promise<void> => expectChangeLabel(page, 'Change 3 of 3, line 294'));

    await test.step('AND it is scrolled into view', async (): Promise<void> => expectLineInView(page, COMPLETE_FILE, '"added_end"'));
  });
});
