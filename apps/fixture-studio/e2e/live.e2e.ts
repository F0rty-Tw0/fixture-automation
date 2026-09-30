import { test } from './live.fixture.ts';
import { SAMPLE_PARTIAL_INVOICE_TS_PATH } from './test/common/fixture-file.const.ts';
import { SAMPLE_SPEC_PATH } from './test/common/playwright.const.ts';
import { typeExtraPrompt } from './test/pages/ai-fill-form.page.ts';
import {
  expectFillNotes,
  expectFilledSource,
  expectLogLine,
  expectValidMerge,
  fillMissingValues
} from './test/pages/ai-fill-panel.page.ts';
import { expectEnvelope, pickExistingFixture } from './test/pages/compare-panel.page.ts';
import { generate, toggleEndpoint } from './test/pages/endpoints-step.page.ts';
import { continueToAiFill, expectMissingPaths } from './test/pages/missing-values-step.page.ts';
import { expectLogEntries } from './test/pages/progress-log.page.ts';
import { expectStepStatus } from './test/pages/rail.page.ts';
import { expectSpecLoaded, loadSpecFromFile, openStudio } from './test/pages/spec-step.page.ts';
import { generateSampleInvoice } from './test/pages/workbench.page.ts';
import { expectCode, expectEndpointTabs } from './test/pages/workspace-step.page.ts';
import { SAMPLE_INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';

/** What the real diff reports for `sample-partial-invoice.fixture.ts` against the sample spec's invoice. */
const LIVE_MISSING_PATHS = ['memo', 'customer'];

/** Makes the mock AI drop the first missing path and reject its answer, so the real API salvages the fill. */
const SALVAGE_SCENARIO = 'An open invoice [mock:salvage]';

/** The salvage note: the rejected answer is kept where valid and the rest comes from the schema. */
const SALVAGE_NOTE = /did not match the schema; 1 value kept from the answer, 1 value filled from the schema\.$/;

/** The mock AI's output for one chunk, merged into one block. */
const MOCK_OUTPUT = 'mock: reading the missing schema mock: sampling values mock: done';

/** Each of the two missing paths needs a prompt over the chunk budget, so each is its own chunk. */
const CHUNKED_LOG = ['Chunk 1 of 2: 1 field…', MOCK_OUTPUT, 'Chunk 2 of 2: 1 field…', MOCK_OUTPUT];

/** A big fixture takes a few seconds to read, diff, render and merge; the whole run stays well under this. */
const BIG_FIXTURE_TIMEOUT_MS = 60_000;

test.describe('FEATURE: live studio', () => {
  // The live API allows only a few CLI fills at once; one test at a time keeps each fill from a 429.
  test.describe.configure({ mode: 'serial' });

  test(
    'GIVEN a partial invoice over 5 MB, it is compared, filled in chunks and merged valid',
    { tag: ['@slow'] },
    async ({ bigInvoicePath, page }): Promise<void> => {
      test.setTimeout(BIG_FIXTURE_TIMEOUT_MS);

      await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page));

      await test.step('AND the sample invoice fixture is generated', async (): Promise<void> => generateSampleInvoice(page));

      await test.step('AND the big partial invoice is dropped into Compare', async (): Promise<void> =>
        pickExistingFixture(page, bigInvoicePath));

      await test.step('THEN the API detected no envelope', async (): Promise<void> =>
        expectEnvelope(page, 'None — the fixture is the payload'));

      await test.step('AND the API diffed it and lists the missing paths', async (): Promise<void> =>
        expectMissingPaths(page, LIVE_MISSING_PATHS));

      await test.step('AND the step counts them', async (): Promise<void> =>
        expectStepStatus(page, 'Missing & broken values', '2 missing · 0 broken'));

      await test.step('WHEN the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

      await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the log shows each chunk and its output', async (): Promise<void> => expectLogEntries(page, CHUNKED_LOG));

      await test.step('AND the merge is valid', async (): Promise<void> => expectValidMerge(page, LIVE_MISSING_PATHS.length));
    }
  );

  test('GIVEN the API sample spec file, picking it generates a real invoice fixture', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page));

    await test.step('AND the sample spec file is picked', async (): Promise<void> => loadSpecFromFile(page, SAMPLE_SPEC_PATH));

    await test.step('THEN the API parsed the spec', async (): Promise<void> => expectSpecLoaded(page, 'Studio API'));

    await test.step('WHEN the invoice endpoint is selected', async (): Promise<void> =>
      toggleEndpoint(page, SAMPLE_INVOICE_ENDPOINT_STUB));

    await test.step('AND generate is pressed', async (): Promise<void> => generate(page));

    await test.step('THEN the workspace has the invoice tab', async (): Promise<void> =>
      expectEndpointTabs(page, [SAMPLE_INVOICE_ENDPOINT_STUB.id]));

    await test.step('AND the editor shows the sampled invoice', async (): Promise<void> =>
      expectCode(page, 'invoice.json', '"id": "in_123"'));
  });

  test('GIVEN a partial .ts fixture, it is compared, filled by the mock CLI and merged valid', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page));

    await test.step('AND the sample invoice fixture is generated', async (): Promise<void> => generateSampleInvoice(page));

    await test.step('AND the partial invoice .ts is picked', async (): Promise<void> =>
      pickExistingFixture(page, SAMPLE_PARTIAL_INVOICE_TS_PATH));

    await test.step('THEN the API lists the missing paths', async (): Promise<void> => expectMissingPaths(page, LIVE_MISSING_PATHS));

    await test.step('WHEN the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the mock CLI progress is logged', async (): Promise<void> => expectLogLine(page, 'mock: done'));

    await test.step('AND the merge is valid', async (): Promise<void> => expectValidMerge(page, LIVE_MISSING_PATHS.length));
  });

  test('GIVEN the mock CLI answers badly, the API salvages the fill and the studio shows where each value came from', async ({
    page
  }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page));

    await test.step('AND the sample invoice fixture is generated', async (): Promise<void> => generateSampleInvoice(page));

    await test.step('AND the partial invoice .ts is picked', async (): Promise<void> =>
      pickExistingFixture(page, SAMPLE_PARTIAL_INVOICE_TS_PATH));

    await test.step('AND the user continues to AI fill', async (): Promise<void> => continueToAiFill(page));

    await test.step('AND a scenario makes the mock answer badly', async (): Promise<void> => typeExtraPrompt(page, SALVAGE_SCENARIO));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the fill still merges valid', async (): Promise<void> => expectValidMerge(page, LIVE_MISSING_PATHS.length));

    await test.step('AND the dropped value is marked as generated from the schema', async (): Promise<void> =>
      expectFilledSource(page, 'memo', 'Generated from the schema'));

    await test.step('AND the kept value is marked as filled by AI', async (): Promise<void> =>
      expectFilledSource(page, 'customer', 'Filled by AI'));

    await test.step('AND the fill explains the salvage', async (): Promise<void> => expectFillNotes(page, [SALVAGE_NOTE]));
  });
});
