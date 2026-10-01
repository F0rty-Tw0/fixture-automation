import type { Download } from '@playwright/test';

import { expect, test } from './ai-fill.fixture.ts';
import { AI_FILL_ROUTE, MERGE_ROUTE } from './test/common/playwright.const.ts';
import type { AiFillOptions } from './test/common/playwright.type.ts';
import { aiFillMock, aiFillOnceMock, mergeMock } from './test/mocks/workbench.mock.ts';
import {
  cancelFill,
  chromeOptIn,
  expectChosenCli,
  expectCliNotInstalled,
  expectFillError,
  expectFillNotes,
  expectFilledSource,
  expectLogCleared,
  expectLogLine,
  expectMergedCode,
  expectMockAiBadge,
  expectNoMergeResult,
  expectProvider,
  expectSchemaErrors,
  expectValidMerge,
  exportMerged,
  fillMissingValues,
  openCliList
} from './test/pages/ai-fill-panel.page.ts';
import { pasteFixture } from './test/pages/compare-panel.page.ts';
import { continueToAiFill } from './test/pages/missing-values-step.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import { expectDownload } from './test/pages/workspace-step.page.ts';
import { INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import {
  CLAUDE_MISSING_TOOLS_STUB,
  ERROR_EVENT_STUB,
  INVALID_MERGE_RESULT_STUB,
  MERGED_JSON_STUB,
  MISSING_FILE_STUB,
  MOCK_AI_TOOLS_STUB,
  PARTIAL_INVOICE_STUB,
  POPULATED_STUB,
  PROGRESS_EVENT_STUB,
  RESULT_EVENT_STUB,
  SALVAGED_RESULT_EVENT_STUB,
  SALVAGE_NOTE_STUB
} from './test/stubs/workbench.stub.ts';
import { ndjsonOf } from './test/utils/ndjson.spec.util.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

const SENT_FILL = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, missing: MISSING_FILE_STUB, tool: 'claude' };

const SENT_MERGE = {
  endpointId: INVOICE_ENDPOINT_STUB.id,
  fixture: PARTIAL_INVOICE_STUB,
  populated: POPULATED_STUB,
  original: PARTIAL_INVOICE_STUB
};

const FILLED_COUNT = MISSING_FILE_STUB.paths.length;

const PROGRESS_LINE = ndjsonOf([PROGRESS_EVENT_STUB]);

/** The progress line cut inside its text, so the first chunk ends mid-JSON. */
const SPLIT_AT = PROGRESS_LINE.indexOf('reading');

test.describe('FEATURE: AI fill with the local CLI', () => {
  test('GIVEN the opt-in off by default, the CLI fills the missing paths', async ({ page }): Promise<void> => {
    const fill = aiFillMock();
    const routes = [apiRoute(AI_FILL_ROUTE, fill), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN Chrome AI is not opted in', async (): Promise<void> => expect(chromeOptIn(page)).not.toBeChecked());

    await test.step('AND the provider is the local CLI', async (): Promise<void> => expectProvider(page, 'Local CLI'));

    await test.step('AND the progress line is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

    await test.step('AND the claude CLI was asked for the missing paths', (): void => expect(fill.bodies).toEqual([SENT_FILL]));
  });

  test('GIVEN a CLI result, it is merged into a valid fixture', async ({ page }): Promise<void> => {
    const merge = mergeMock();
    const routes = [apiRoute(AI_FILL_ROUTE, aiFillMock()), apiRoute(MERGE_ROUTE, merge)];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('AND the merged fixture shows the filled memo', async (): Promise<void> =>
      expectMergedCode(page, 'invoice.json', '"memo": "Net 30"'));

    await test.step('AND the populated values were sent to merge', (): void => expect(merge.bodies).toEqual([SENT_MERGE]));
  });

  test('GIVEN a CLI result the API salvaged, its notes and each value source are shown', async ({ page }): Promise<void> => {
    const fill = aiFillMock([PROGRESS_EVENT_STUB, SALVAGED_RESULT_EVENT_STUB]);
    const routes = [apiRoute(AI_FILL_ROUTE, fill), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('AND the salvage note is shown', async (): Promise<void> => expectFillNotes(page, [SALVAGE_NOTE_STUB]));

    await test.step('AND the memo is credited to AI', async (): Promise<void> => expectFilledSource(page, 'memo', 'Filled by AI'));

    await test.step('AND the customer id is credited to the schema sampler', async (): Promise<void> =>
      expectFilledSource(page, 'customer.id', 'Generated from the schema'));
  });

  test('GIVEN a line split across stream chunks, it reaches the log whole', async ({ cliStream, page }): Promise<void> => {
    const routes = [apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the CLI sends the first part of a line', async (): Promise<void> =>
      cliStream.write(PROGRESS_LINE.slice(0, SPLIT_AT)));

    await test.step('AND the CLI sends the rest of the line', async (): Promise<void> =>
      cliStream.write(PROGRESS_LINE.slice(SPLIT_AT)));

    await test.step('THEN the whole line is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

    await test.step('WHEN the CLI sends its result', async (): Promise<void> => cliStream.write(ndjsonOf([RESULT_EVENT_STUB])));

    await test.step('AND the CLI ends the stream', async (): Promise<void> => cliStream.end());

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));
  });

  test('GIVEN a merged fill, filling again drops it while the new run works', async ({ cliStream, page }): Promise<void> => {
    const routes = [apiRoute(AI_FILL_ROUTE, aiFillOnceMock()), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('WHEN the missing values are filled again', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the new run reports progress', async (): Promise<void> => cliStream.write(PROGRESS_LINE));

    await test.step('THEN its progress is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

    await test.step('AND the earlier merge is gone while it works', async (): Promise<void> => expectNoMergeResult(page));
  });

  test('GIVEN a running CLI fill, cancel aborts its request', async ({ cliStream, page }): Promise<void> => {
    const isAborted = (): boolean => cliStream.isAborted();

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> => openInvoiceAiFill(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the CLI reports progress', async (): Promise<void> => cliStream.write(PROGRESS_LINE));

    await test.step('THEN the progress line is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

    await test.step('WHEN the run is cancelled', async (): Promise<void> => cancelFill(page));

    await test.step('THEN the browser closed the request', async (): Promise<void> => expect.poll(isAborted).toBe(true));

    await test.step('AND the log says it was cancelled', async (): Promise<void> => expectLogLine(page, 'Cancelled.'));
  });

  test('GIVEN an invalid merge, its schema errors are listed', async ({ page }): Promise<void> => {
    const routes = [apiRoute(AI_FILL_ROUTE, aiFillMock()), apiRoute(MERGE_ROUTE, mergeMock(INVALID_MERGE_RESULT_STUB))];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN every schema error is listed', async (): Promise<void> =>
      expectSchemaErrors(page, INVALID_MERGE_RESULT_STUB.errors));
  });

  test('GIVEN a CLI error event, the notice shows its message and fix', async ({ page }): Promise<void> => {
    const routes = [apiRoute(AI_FILL_ROUTE, aiFillMock([PROGRESS_EVENT_STUB, ERROR_EVENT_STUB]))];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the notice shows the CLI error', async (): Promise<void> => expectFillError(page, ERROR_EVENT_STUB));
  });

  test('GIVEN a valid merge, the merged fixture exports under the schema name', async ({ page }): Promise<void> => {
    const routes = [apiRoute(AI_FILL_ROUTE, aiFillMock()), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    const download = await test.step('WHEN the merged fixture is exported', async (): Promise<Download> => exportMerged(page));

    await test.step('THEN invoice.json holds the merged fixture', async (): Promise<void> =>
      expectDownload(download, 'invoice.json', MERGED_JSON_STUB));
  });

  test('GIVEN a finished CLI fill, comparing another fixture clears the previous AI result', async ({ page }): Promise<void> => {
    const otherInvoice = JSON.stringify({ ...PARTIAL_INVOICE_STUB, id: 'in_999' });
    const routes = [apiRoute(AI_FILL_ROUTE, aiFillMock()), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('WHEN another invoice is pasted', async (): Promise<void> => pasteFixture(page, otherInvoice));

    await test.step('AND the user continues to AI fill again', async (): Promise<void> => continueToAiFill(page));

    await test.step('THEN the previous merge result is gone', async (): Promise<void> => expectNoMergeResult(page));

    await test.step('AND the previous progress is cleared', async (): Promise<void> =>
      expectLogCleared(page, PROGRESS_EVENT_STUB.text));
  });

  test('GIVEN only codex on the PATH, a missing CLI is offered disabled and the installed one is chosen', async ({
    page
  }): Promise<void> => {
    const options: AiFillOptions = { tools: CLAUDE_MISSING_TOOLS_STUB };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('THEN codex is chosen', async (): Promise<void> => expectChosenCli(page, 'codex'));

    await test.step('WHEN the CLI list is opened', async (): Promise<void> => openCliList(page));

    await test.step('THEN claude is marked not installed', async (): Promise<void> => expectCliNotInstalled(page, 'claude'));
  });

  test('GIVEN an API running the mock AI, the mock is badged next to the CLI', async ({ page }): Promise<void> => {
    const options: AiFillOptions = { tools: MOCK_AI_TOOLS_STUB };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('THEN the mock badge is shown', async (): Promise<void> => expectMockAiBadge(page));
  });
});
