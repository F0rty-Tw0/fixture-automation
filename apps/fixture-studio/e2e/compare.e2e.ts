import type { DiffResult } from '@fixture-automation/fixture-studio-api/contract';

import { expect, test } from './mocked-api.fixture.ts';
import {
  BROKEN_INVOICE_TS_PATH,
  DEFAULT_EXPORT_INVOICE_TS_PATH,
  PARTIAL_INVOICE_JSON_PATH,
  PARTIAL_INVOICE_TS_PATH
} from './test/common/fixture-file.const.ts';
import { CLI_MODELS_ROUTE, CLI_TOOLS_ROUTE, DIFF_ROUTE } from './test/common/playwright.const.ts';
import { cliModelsMock, cliToolsMock, diffMock } from './test/mocks/workbench.mock.ts';
import { expectAiFillDisabled, expectAiFillOpen } from './test/pages/ai-fill-panel.page.ts';
import {
  compareWithSchema,
  expectComparing,
  expectInsertedLine,
  expectMissingPaths,
  expectNothingMissing,
  expectReplacedPaths,
  expectSourceRejected,
  fillWithAi,
  keepPlaceholders,
  pasteFixture,
  pickExistingFixture,
  setEnvelopeProperty
} from './test/pages/compare-panel.page.ts';
import { openInvoiceCompare, routeWorkbenchApi } from './test/pages/workbench.page.ts';
import { INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import { COMPLETE_DIFF_RESULT_STUB, DIFF_RESULT_STUB, PARTIAL_INVOICE_STUB } from './test/stubs/workbench.stub.ts';
import { routeApi } from './test/utils/route.spec.util.ts';

const SENT_DIFF = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, requiredOnly: false, replacePlaceholders: true };

const REPLACED_PATHS = ['amount_due'];

const REPLACED_DIFF_RESULT: DiffResult = {
  ...DIFF_RESULT_STUB,
  missingPaths: [...DIFF_RESULT_STUB.missingPaths, ...REPLACED_PATHS],
  replacedPaths: REPLACED_PATHS
};

const BROKEN_TS_MESSAGE = "Line 5: a function call can't be read without running the file; use plain literals.";

test.describe('FEATURE: compare an existing fixture', () => {
  test.describe('GIVEN the invoice fixture is generated and Compare is open', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the Compare tab of the invoice is open', async (): Promise<void> => openInvoiceCompare(page));
    });

    test('SCENARIO: a local JSON fixture lists its missing paths', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN it is compared at once and the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the parsed fixture was sent for the diff', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('SCENARIO: a TypeScript fixture is read as literals without running it', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice .ts is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_TS_PATH));

      await test.step('THEN it is the fixture being compared', async (): Promise<void> =>
        expectComparing(page, 'partial-invoice.fixture.ts'));

      await test.step('THEN the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the literal value was sent for the diff', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('SCENARIO: pasted JSON is compared like a file', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice is pasted', async (): Promise<void> =>
        pasteFixture(page, JSON.stringify(PARTIAL_INVOICE_STUB)));

      await test.step('THEN the pasted text is being compared', async (): Promise<void> => expectComparing(page, 'Pasted text'));

      await test.step('THEN the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the pasted value was sent for the diff', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('SCENARIO: a TypeScript fixture exporting a const by name is read as that const', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the default-export invoice .ts is picked', async (): Promise<void> =>
        pickExistingFixture(page, DEFAULT_EXPORT_INVOICE_TS_PATH));

      await test.step('THEN it is the fixture being compared', async (): Promise<void> =>
        expectComparing(page, 'default-export-invoice.fixture.ts'));

      await test.step('THEN the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the exported const, not the first one, was sent', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('SCENARIO: a TypeScript fixture that calls a function is rejected', async ({ page }): Promise<void> => {
      await test.step('WHEN the broken invoice .ts is picked', async (): Promise<void> =>
        pickExistingFixture(page, BROKEN_INVOICE_TS_PATH));

      await test.step('THEN the call is named with its line', async (): Promise<void> =>
        expectSourceRejected(page, BROKEN_TS_MESSAGE));
    });

    test('SCENARIO: the envelope property is sent as the object shape', async ({ page }): Promise<void> => {
      const diff = diffMock();
      const envelope = { data: PARTIAL_INVOICE_STUB };
      const sentDiff = { ...SENT_DIFF, fixture: envelope, objectShape: 'data' };

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN an enveloped invoice is pasted', async (): Promise<void> => pasteFixture(page, JSON.stringify(envelope)));

      await test.step('THEN it is compared at once', async (): Promise<void> => expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('WHEN the envelope property is "data"', async (): Promise<void> => setEnvelopeProperty(page, 'data'));

      await test.step('AND it is compared again', async (): Promise<void> => compareWithSchema(page));

      await test.step('THEN the second diff sent the object shape', async (): Promise<void> =>
        expect.poll(() => diff.bodies).toEqual([{ ...SENT_DIFF, fixture: envelope }, sentDiff]));
    });

    test('SCENARIO: the complete fixture is shown as a diff with inserted lines', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diffMock().handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the memo line is marked inserted', async (): Promise<void> =>
        expectInsertedLine(page, 'invoice.complete.json', '"memo"'));

      await test.step('AND the customer line is marked inserted', async (): Promise<void> =>
        expectInsertedLine(page, 'invoice.complete.json', '"customer"'));
    });

    test('SCENARIO: placeholder values are listed apart and counted in the fill', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API replaces a placeholder value', async (): Promise<void> =>
        routeApi(page, DIFF_ROUTE, diffMock(REPLACED_DIFF_RESULT).handler));

      await test.step('AND the API lists installed CLIs', async (): Promise<void> => routeApi(page, CLI_TOOLS_ROUTE, cliToolsMock().handler));

      await test.step('AND the API lists CLI models', async (): Promise<void> => routeApi(page, CLI_MODELS_ROUTE, cliModelsMock().handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the absent paths are listed as missing', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the placeholder is listed as replaced', async (): Promise<void> => expectReplacedPaths(page, REPLACED_PATHS));

      await test.step('AND the fill shortcut counts both', async (): Promise<void> =>
        fillWithAi(page, REPLACED_DIFF_RESULT.missingPaths.length));

      await test.step('THEN the AI fill tab is open', async (): Promise<void> => expectAiFillOpen(page));
    });

    test('SCENARIO: unchecking the replace box keeps placeholder values', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN it is compared at once', async (): Promise<void> => expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('WHEN the replace box is unchecked', async (): Promise<void> => keepPlaceholders(page));

      await test.step('AND it is compared again', async (): Promise<void> => compareWithSchema(page));

      await test.step('THEN the second diff was asked to keep them', async (): Promise<void> =>
        expect.poll(() => diff.bodies).toEqual([SENT_DIFF, { ...SENT_DIFF, replacePlaceholders: false }]));
    });

    test('SCENARIO: a complete fixture keeps AI fill disabled', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API finds nothing missing', async (): Promise<void> =>
        routeApi(page, DIFF_ROUTE, diffMock(COMPLETE_DIFF_RESULT_STUB).handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN nothing is reported missing', async (): Promise<void> => expectNothingMissing(page));

      await test.step('AND AI fill stays disabled', async (): Promise<void> => expectAiFillDisabled(page));
    });

    test('SCENARIO: the fill-with-AI shortcut opens the AI fill tab', async ({ page }): Promise<void> => {
      await test.step('GIVEN the workbench API answers every call', async (): Promise<void> => routeWorkbenchApi(page));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('AND the fill-with-AI shortcut is pressed', async (): Promise<void> =>
        fillWithAi(page, DIFF_RESULT_STUB.missingPaths.length));

      await test.step('THEN the AI fill tab is open', async (): Promise<void> => expectAiFillOpen(page));
    });
  });
});
