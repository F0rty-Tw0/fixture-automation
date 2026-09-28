import { expect, test } from './mocked-api.fixture.ts';
import {
  BROKEN_INVOICE_TS_PATH,
  DEFAULT_EXPORT_INVOICE_TS_PATH,
  PARTIAL_INVOICE_JSON_PATH,
  PARTIAL_INVOICE_TS_PATH
} from './test/common/fixture-file.const.ts';
import { CLI_MODELS_ROUTE, CLI_TOOLS_ROUTE, DIFF_ROUTE, ENVELOPE_ROUTE } from './test/common/playwright.const.ts';
import { cliModelsMock, cliToolsMock, diffMock, envelopeMock } from './test/mocks/workbench.mock.ts';
import { expectAiFillOpen, expectAiFillWaiting } from './test/pages/ai-fill-panel.page.ts';
import {
  chooseEnvelope,
  compareWithSchema,
  expectComparing,
  expectEnvelope,
  expectInsertedLine,
  expectSourceRejected,
  pasteFixture,
  pickExistingFixture
} from './test/pages/compare-panel.page.ts';
import {
  continueToAiFill,
  expectBrokenValues,
  expectFillCount,
  expectMissingPaths,
  expectNothingMissing,
  expectNothingToFill,
  keepBrokenValues
} from './test/pages/missing-values-step.page.ts';
import { openInvoiceCompare, routeWorkbenchApi } from './test/pages/workbench.page.ts';
import { INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import {
  BROKEN_AMOUNT_STUB,
  BROKEN_DIFF_RESULT_STUB,
  COMPLETE_DIFF_RESULT_STUB,
  DATA_ENVELOPE_STUB,
  DIFF_RESULT_STUB,
  PARTIAL_INVOICE_STUB
} from './test/stubs/workbench.stub.ts';
import { routeApi } from './test/utils/route.spec.util.ts';

const SENT_DIFF = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, requiredOnly: false, replacePlaceholders: true };

const BROKEN_TS_MESSAGE = "Line 5: a function call can't be read without running the file; use plain literals.";

test.describe('FEATURE: compare an existing fixture', () => {
  test.describe('GIVEN the invoice fixture is generated and its Compare step is active', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the Compare step of the invoice is active', async (): Promise<void> => openInvoiceCompare(page));
    });

    test('GIVEN a local JSON fixture, it is compared at once and its missing paths are listed', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the missing paths are listed in the next step', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the parsed fixture was sent for the diff', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('GIVEN a TypeScript fixture, it is read as literals without running it', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice .ts is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_TS_PATH));

      await test.step('THEN it is the fixture being compared', async (): Promise<void> =>
        expectComparing(page, 'partial-invoice.fixture.ts'));

      await test.step('AND the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the literal value was sent for the diff', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('GIVEN pasted JSON, it is compared like a file', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice is pasted', async (): Promise<void> =>
        pasteFixture(page, JSON.stringify(PARTIAL_INVOICE_STUB)));

      await test.step('THEN the pasted text is being compared', async (): Promise<void> => expectComparing(page, 'Pasted text'));

      await test.step('AND the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the pasted value was sent for the diff', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('GIVEN a TypeScript fixture exporting a const by name, that const is read', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the default-export invoice .ts is picked', async (): Promise<void> =>
        pickExistingFixture(page, DEFAULT_EXPORT_INVOICE_TS_PATH));

      await test.step('THEN it is the fixture being compared', async (): Promise<void> =>
        expectComparing(page, 'default-export-invoice.fixture.ts'));

      await test.step('AND the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the exported const, not the first one, was sent', (): void => expect(diff.bodies).toEqual([SENT_DIFF]));
    });

    test('GIVEN a TypeScript fixture that calls a function, it is rejected', async ({ page }): Promise<void> => {
      await test.step('WHEN the broken invoice .ts is picked', async (): Promise<void> =>
        pickExistingFixture(page, BROKEN_INVOICE_TS_PATH));

      await test.step('THEN the call is named with its line', async (): Promise<void> =>
        expectSourceRejected(page, BROKEN_TS_MESSAGE));
    });

    test('GIVEN the API detects an envelope, it is preselected and a change compares again', async ({ page }): Promise<void> => {
      const diff = diffMock();
      const envelope = envelopeMock(DATA_ENVELOPE_STUB);
      const enveloped = { data: PARTIAL_INVOICE_STUB };
      const insideData = { ...SENT_DIFF, fixture: enveloped, objectShape: 'data' };
      const asPayload = { ...SENT_DIFF, fixture: enveloped };

      await test.step('GIVEN the API detects the data envelope', async (): Promise<void> =>
        routeApi(page, ENVELOPE_ROUTE, envelope.handler));

      await test.step('AND the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN an enveloped invoice is pasted', async (): Promise<void> => pasteFixture(page, JSON.stringify(enveloped)));

      await test.step('THEN the detected envelope is chosen', async (): Promise<void> => expectEnvelope(page, 'data'));

      await test.step('AND the fixture was diffed inside it', async (): Promise<void> =>
        expect.poll(() => diff.bodies).toEqual([insideData]));

      await test.step('WHEN no envelope is chosen', async (): Promise<void> => chooseEnvelope(page, 'None — the fixture is the payload'));

      await test.step('THEN it is diffed again as the payload', async (): Promise<void> =>
        expect.poll(() => diff.bodies).toEqual([insideData, asPayload]));

      await test.step('AND the envelope was asked about the parsed fixture', (): void =>
        expect(envelope.bodies).toEqual([{ endpointId: INVOICE_ENDPOINT_STUB.id, fixture: enveloped }]));
    });

    test('GIVEN the complete fixture, it is shown as a diff with inserted lines', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diffMock().handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the memo line is marked inserted', async (): Promise<void> =>
        expectInsertedLine(page, 'invoice.complete.json', '"memo"'));

      await test.step('AND the customer line is marked inserted', async (): Promise<void> =>
        expectInsertedLine(page, 'invoice.complete.json', '"customer"'));
    });

    test('GIVEN a placeholder value, it is listed as broken and counted in the fill', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API replaces a placeholder value', async (): Promise<void> =>
        routeApi(page, DIFF_ROUTE, diffMock(BROKEN_DIFF_RESULT_STUB).handler));

      await test.step('AND the API lists installed CLIs', async (): Promise<void> => routeApi(page, CLI_TOOLS_ROUTE, cliToolsMock().handler));

      await test.step('AND the API lists CLI models', async (): Promise<void> => routeApi(page, CLI_MODELS_ROUTE, cliModelsMock().handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the absent paths are listed as missing', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND the placeholder is listed as broken', async (): Promise<void> =>
        expectBrokenValues(page, [BROKEN_AMOUNT_STUB.path]));

      await test.step('AND the fill counts both', async (): Promise<void> =>
        expectFillCount(page, BROKEN_DIFF_RESULT_STUB.missingPaths.length));

      await test.step('AND AI fill waits until the user continues', async (): Promise<void> => expectAiFillWaiting(page));

      await test.step('WHEN the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

      await test.step('THEN the AI fill step is open', async (): Promise<void> => expectAiFillOpen(page));
    });

    test('GIVEN broken values, keeping them compares again without refilling them', async ({ page }): Promise<void> => {
      const diff = diffMock(BROKEN_DIFF_RESULT_STUB);

      await test.step('GIVEN the API reports a broken value', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN the broken value is listed', async (): Promise<void> =>
        expectBrokenValues(page, [BROKEN_AMOUNT_STUB.path]));

      await test.step('WHEN broken values are kept', async (): Promise<void> => keepBrokenValues(page));

      await test.step('THEN the second diff was asked to keep them', async (): Promise<void> =>
        expect.poll(() => diff.bodies).toEqual([SENT_DIFF, { ...SENT_DIFF, replacePlaceholders: false }]));
    });

    test('GIVEN an unchanged form, compare with schema does not diff again', async ({ page }): Promise<void> => {
      const diff = diffMock();

      await test.step('GIVEN the API diffs fixtures', async (): Promise<void> => routeApi(page, DIFF_ROUTE, diff.handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('AND it is compared once more', async (): Promise<void> => compareWithSchema(page));

      await test.step('THEN the missing paths are listed', async (): Promise<void> =>
        expectMissingPaths(page, DIFF_RESULT_STUB.missingPaths));

      await test.step('AND only one diff was sent', (): void => expect(diff.bodies).toHaveLength(1));
    });

    test('GIVEN a complete fixture, AI fill is not offered', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API finds nothing missing', async (): Promise<void> =>
        routeApi(page, DIFF_ROUTE, diffMock(COMPLETE_DIFF_RESULT_STUB).handler));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('THEN nothing is reported missing', async (): Promise<void> => expectNothingMissing(page));

      await test.step('AND there is nothing to fill', async (): Promise<void> => expectNothingToFill(page));

      await test.step('AND AI fill keeps waiting', async (): Promise<void> => expectAiFillWaiting(page));
    });

    test('GIVEN missing values, continuing opens the AI fill step', async ({ page }): Promise<void> => {
      await test.step('GIVEN the workbench API answers every call', async (): Promise<void> => routeWorkbenchApi(page));

      await test.step('WHEN the partial invoice JSON is picked', async (): Promise<void> =>
        pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH));

      await test.step('AND the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

      await test.step('THEN the AI fill step is open', async (): Promise<void> => expectAiFillOpen(page));
    });
  });
});
