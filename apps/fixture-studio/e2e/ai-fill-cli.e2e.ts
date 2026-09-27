import type { Download } from '@playwright/test';

import { expect, test } from './ai-fill.fixture.ts';
import { AI_FILL_ROUTE, MERGE_ROUTE } from './test/common/playwright.const.ts';
import { apiErrorMock } from './test/mocks/studio-api.mock.ts';
import { aiFillMock, mergeMock } from './test/mocks/workbench.mock.ts';
import {
  cancelFill,
  chromeOptIn,
  expectChosenCli,
  expectCliNotInstalled,
  expectFillError,
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
  openAiFillTab,
  openCliList
} from './test/pages/ai-fill-panel.page.ts';
import { openCompareTab, pasteFixture } from './test/pages/compare-panel.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import { expectDownload } from './test/pages/workspace-step.page.ts';
import { INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import {
  CLAUDE_MISSING_TOOLS_STUB,
  DIFF_RESULT_STUB,
  ERROR_EVENT_STUB,
  INVALID_MERGE_RESULT_STUB,
  MERGED_JSON_STUB,
  MISSING_FILE_STUB,
  MOCK_AI_TOOLS_STUB,
  PARTIAL_INVOICE_STUB,
  POPULATED_STUB,
  PROGRESS_EVENT_STUB,
  RESULT_EVENT_STUB,
  TOO_MANY_RUNS_ERROR_STUB
} from './test/stubs/workbench.stub.ts';
import { ndjsonOf } from './test/utils/ndjson.spec.util.ts';
import { routeApi } from './test/utils/route.spec.util.ts';

const SENT_FILL = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, missing: MISSING_FILE_STUB, tool: 'claude' };

const SENT_MERGE = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, populated: POPULATED_STUB, original: PARTIAL_INVOICE_STUB };

const FILLED_COUNT = MISSING_FILE_STUB.paths.length;

const PROGRESS_LINE = ndjsonOf([PROGRESS_EVENT_STUB]);

/** The progress line cut inside its text, so the first chunk ends mid-JSON. */
const SPLIT_AT = PROGRESS_LINE.indexOf('reading');

test.describe('FEATURE: AI fill with the local CLI', () => {
  test.describe('GIVEN the partial invoice was compared and AI fill is open', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the AI fill tab of the compared invoice is open', async (): Promise<void> => openInvoiceAiFill(page));
    });

    test('SCENARIO: with the opt-in off by default the CLI fills the missing paths', async ({ page }): Promise<void> => {
      const fill = aiFillMock();

      await test.step('GIVEN the CLI streams progress and a result', async (): Promise<void> =>
        routeApi(page, AI_FILL_ROUTE, fill.handler));

      await test.step('AND the API merges the answer', async (): Promise<void> => routeApi(page, MERGE_ROUTE, mergeMock().handler));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN on-device Chrome AI is not opted in', async (): Promise<void> =>
        expect(chromeOptIn(page)).not.toBeChecked());

      await test.step('AND the provider is the local CLI', async (): Promise<void> => expectProvider(page, 'Local CLI'));

      await test.step('AND the progress line is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

      await test.step('AND the claude CLI was asked for the missing paths', (): void => expect(fill.bodies).toEqual([SENT_FILL]));
    });

    test('SCENARIO: the CLI answer is merged into a valid fixture', async ({ page }): Promise<void> => {
      const merge = mergeMock();

      await test.step('GIVEN the CLI streams progress and a result', async (): Promise<void> =>
        routeApi(page, AI_FILL_ROUTE, aiFillMock().handler));

      await test.step('AND the API merges the answer', async (): Promise<void> => routeApi(page, MERGE_ROUTE, merge.handler));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

      await test.step('AND the merged fixture shows the filled memo', async (): Promise<void> =>
        expectMergedCode(page, 'invoice.json', '"memo": "Net 30"'));

      await test.step('AND the populated values were sent to merge', (): void => expect(merge.bodies).toEqual([SENT_MERGE]));
    });

    test('SCENARIO: a line split across stream chunks reaches the log whole', async ({ cliStream, page }): Promise<void> => {
      await test.step('GIVEN the API merges the answer', async (): Promise<void> => routeApi(page, MERGE_ROUTE, mergeMock().handler));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('AND the CLI sends the first part of a line', async (): Promise<void> =>
        cliStream.write(PROGRESS_LINE.slice(0, SPLIT_AT)));

      await test.step('AND the CLI sends the rest of the line', async (): Promise<void> =>
        cliStream.write(PROGRESS_LINE.slice(SPLIT_AT)));

      await test.step('THEN the whole line is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

      await test.step('AND the CLI sends its result', async (): Promise<void> => cliStream.write(ndjsonOf([RESULT_EVENT_STUB])));

      await test.step('AND the CLI ends the stream', async (): Promise<void> => cliStream.end());

      await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));
    });

    test('SCENARIO: cancel aborts the running CLI request', async ({ cliStream, page }): Promise<void> => {
      const isAborted = (): boolean => cliStream.isAborted();

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('AND the CLI reports progress', async (): Promise<void> => cliStream.write(PROGRESS_LINE));

      await test.step('THEN the progress line is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

      await test.step('AND the run is cancelled', async (): Promise<void> => cancelFill(page));

      await test.step('THEN the browser closed the request', async (): Promise<void> => expect.poll(isAborted).toBe(true));

      await test.step('AND the log says it was cancelled', async (): Promise<void> => expectLogLine(page, 'Cancelled.'));
    });

    test('SCENARIO: an invalid merge lists its schema errors', async ({ page }): Promise<void> => {
      await test.step('GIVEN the CLI streams progress and a result', async (): Promise<void> =>
        routeApi(page, AI_FILL_ROUTE, aiFillMock().handler));

      await test.step('AND the merge breaks the schema', async (): Promise<void> =>
        routeApi(page, MERGE_ROUTE, mergeMock(INVALID_MERGE_RESULT_STUB).handler));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN every schema error is listed', async (): Promise<void> =>
        expectSchemaErrors(page, INVALID_MERGE_RESULT_STUB.errors));
    });

    test('SCENARIO: a CLI error event shows its message and fix', async ({ page }): Promise<void> => {
      const failing = aiFillMock([PROGRESS_EVENT_STUB, ERROR_EVENT_STUB]);

      await test.step('GIVEN the CLI streams progress and then an error', async (): Promise<void> =>
        routeApi(page, AI_FILL_ROUTE, failing.handler));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the notice shows the CLI error', async (): Promise<void> => expectFillError(page, ERROR_EVENT_STUB));
    });

    test('SCENARIO: the merged fixture exports under the schema name', async ({ page }): Promise<void> => {
      await test.step('GIVEN the CLI streams progress and a result', async (): Promise<void> =>
        routeApi(page, AI_FILL_ROUTE, aiFillMock().handler));

      await test.step('AND the API merges the answer', async (): Promise<void> => routeApi(page, MERGE_ROUTE, mergeMock().handler));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

      const download = await test.step('AND the merged fixture is exported', async (): Promise<Download> => exportMerged(page));

      await test.step('THEN invoice.json holds the merged fixture', async (): Promise<void> =>
        expectDownload(download, 'invoice.json', MERGED_JSON_STUB));
    });

    test('SCENARIO: a new compare with another fixture clears the previous AI result', async ({ page }): Promise<void> => {
      const otherInvoice = JSON.stringify({ ...PARTIAL_INVOICE_STUB, id: 'in_999' });

      await test.step('GIVEN the CLI streams progress and a result', async (): Promise<void> =>
        routeApi(page, AI_FILL_ROUTE, aiFillMock().handler));

      await test.step('AND the API merges the answer', async (): Promise<void> => routeApi(page, MERGE_ROUTE, mergeMock().handler));

      await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

      await test.step('AND the Compare tab is reopened', async (): Promise<void> => openCompareTab(page));

      await test.step('AND another invoice is pasted', async (): Promise<void> => pasteFixture(page, otherInvoice));

      await test.step('AND the AI fill tab is reopened', async (): Promise<void> => openAiFillTab(page));

      await test.step('THEN the previous merge result is gone', async (): Promise<void> => expectNoMergeResult(page));

      await test.step('AND the previous progress is cleared', async (): Promise<void> =>
        expectLogCleared(page, PROGRESS_EVENT_STUB.text));
    });

    test.describe('GIVEN every AI CLI slot is taken', () => {
      test.use({ allowedConsoleErrors: [/status of 429/u] });

      test('SCENARIO: the 429 shows the API message and fix', async ({ page }): Promise<void> => {
        await test.step('GIVEN the fill route answers 429', async (): Promise<void> =>
          routeApi(page, AI_FILL_ROUTE, apiErrorMock(TOO_MANY_RUNS_ERROR_STUB, 429)));

        await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

        await test.step('THEN the notice shows the API error', async (): Promise<void> =>
          expectFillError(page, TOO_MANY_RUNS_ERROR_STUB));
      });
    });
  });

  test.describe('GIVEN the partial invoice was compared and the install check answers', () => {
    test('SCENARIO: a CLI missing from PATH is offered disabled and an installed one is chosen', async ({ page }): Promise<void> => {
      await test.step('GIVEN only codex is installed and the AI fill tab is open', async (): Promise<void> =>
        openInvoiceAiFill(page, DIFF_RESULT_STUB, CLAUDE_MISSING_TOOLS_STUB));

      await test.step('THEN codex is chosen', async (): Promise<void> => expectChosenCli(page, 'codex'));

      await test.step('WHEN the CLI list is opened', async (): Promise<void> => openCliList(page));

      await test.step('THEN claude is marked not installed', async (): Promise<void> => expectCliNotInstalled(page, 'claude'));
    });

    test('SCENARIO: the mock AI is badged next to the CLI', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API runs the mock AI and the AI fill tab is open', async (): Promise<void> =>
        openInvoiceAiFill(page, DIFF_RESULT_STUB, MOCK_AI_TOOLS_STUB));

      await test.step('THEN the mock badge is shown', async (): Promise<void> => expectMockAiBadge(page));
    });
  });
});
