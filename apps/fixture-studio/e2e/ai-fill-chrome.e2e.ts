import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';

import { expect, test } from './mocked-api.fixture.ts';
import { AI_PROMPT_ROUTE, MERGE_ROUTE } from './test/common/playwright.const.ts';
import type { LanguageModelStubConfig } from './test/common/playwright.type.ts';
import { aiPromptMock, mergeMock } from './test/mocks/workbench.mock.ts';
import {
  chromeOptIn,
  expectAvailability,
  expectDownloadProgress,
  expectFillError,
  expectProvider,
  expectValidMerge,
  fillMissingValues,
  toggleChromeOptIn
} from './test/pages/ai-fill-panel.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import {
  AVAILABLE_MODEL_STUB,
  DOWNLOADABLE_MODEL_STUB,
  DOWNLOADING_MODEL_STUB,
  TOO_SMALL_MODEL_STUB,
  UNAVAILABLE_MODEL_STUB
} from './test/stubs/language-model.stub.ts';
import { INVOICE_ENDPOINT_STUB } from './test/stubs/studio-api.stub.ts';
import { AI_PROMPT_STUB, MISSING_FILE_STUB, PARTIAL_INVOICE_STUB, POPULATED_STUB } from './test/stubs/workbench.stub.ts';
import { languageModelCalls, releaseModelDownload, stubLanguageModel } from './test/utils/language-model.spec.util.ts';
import { routeApi } from './test/utils/route.spec.util.ts';

type AvailabilityCase = {
  readonly config: LanguageModelStubConfig;
  readonly label: string;
  readonly provider: string;
};

const AVAILABILITY_CASES: AvailabilityCase[] = [
  { config: AVAILABLE_MODEL_STUB, label: 'Ready', provider: 'On-device Chrome AI' },
  { config: DOWNLOADABLE_MODEL_STUB, label: 'Downloads the model on first run', provider: 'On-device Chrome AI' },
  { config: DOWNLOADING_MODEL_STUB, label: 'Downloading the model', provider: 'On-device Chrome AI' },
  { config: UNAVAILABLE_MODEL_STUB, label: 'Not available in this browser', provider: 'Local CLI' }
];

const SENT_PROMPT = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, missing: MISSING_FILE_STUB };

const SENT_MERGE = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, populated: POPULATED_STUB, original: PARTIAL_INVOICE_STUB };

const CONSTRAINED_PROMPT = { input: AI_PROMPT_STUB.prompt, hasResponseConstraint: true };

const TOO_LARGE_ERROR: ApiErrorBody = {
  message: 'This fixture is too large for the on-device model.',
  fix: 'Turn off "Use on-device Chrome AI" to fill it with the local CLI instead.'
};

const FILLED_COUNT = MISSING_FILE_STUB.paths.length;

test.describe('FEATURE: AI fill with on-device Chrome AI', () => {
  for (const availabilityCase of AVAILABILITY_CASES) {
    test.describe(`GIVEN Chrome reports the model ${availabilityCase.config.availability}`, () => {
      test.beforeEach(async ({ page }): Promise<void> => {
        await test.step('GIVEN the Prompt API is stubbed', async (): Promise<void> =>
          stubLanguageModel(page, availabilityCase.config));

        await test.step('AND the AI fill tab of the compared invoice is open', async (): Promise<void> => openInvoiceAiFill(page));
      });

      test(`SCENARIO: opting in reads "${availabilityCase.label}"`, async ({ page }): Promise<void> => {
        await test.step('WHEN on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

        await test.step('THEN the availability is labelled', async (): Promise<void> =>
          expectAvailability(page, availabilityCase.label));

        await test.step('AND the provider follows it', async (): Promise<void> => expectProvider(page, availabilityCase.provider));
      });
    });
  }

  test.describe('GIVEN Chrome AI is available', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the Prompt API is stubbed', async (): Promise<void> => stubLanguageModel(page, AVAILABLE_MODEL_STUB));

      await test.step('AND the AI fill tab of the compared invoice is open', async (): Promise<void> => openInvoiceAiFill(page));
    });

    test('SCENARIO: an opted-in fill runs on the device, not through the CLI', async ({ page }): Promise<void> => {
      const prompt = aiPromptMock();
      const merge = mergeMock();
      const promptCalls = async (): Promise<unknown> => languageModelCalls(page);

      await test.step('GIVEN the API builds the prompt', async (): Promise<void> => routeApi(page, AI_PROMPT_ROUTE, prompt.handler));

      await test.step('AND the API merges the answer', async (): Promise<void> => routeApi(page, MERGE_ROUTE, merge.handler));

      await test.step('WHEN on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

      await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

      await test.step('AND the prompt was built for the missing paths', (): void => expect(prompt.bodies).toEqual([SENT_PROMPT]));

      await test.step('AND the model was prompted with the response schema', async (): Promise<void> =>
        expect.poll(promptCalls).toEqual([CONSTRAINED_PROMPT]));

      await test.step('AND the streamed chunks were merged as one answer', (): void => expect(merge.bodies).toEqual([SENT_MERGE]));
    });

    test('SCENARIO: the opt-in survives a reload', async ({ page }): Promise<void> => {
      await test.step('WHEN on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

      await test.step('AND the studio is opened again at AI fill', async (): Promise<void> => openInvoiceAiFill(page));

      await test.step('THEN the opt-in is still checked', async (): Promise<void> => expect(chromeOptIn(page)).toBeChecked());

      await test.step('AND the provider is on-device Chrome AI', async (): Promise<void> =>
        expectProvider(page, 'On-device Chrome AI'));
    });
  });

  test.describe('GIVEN the model must be downloaded first', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the Prompt API holds its download', async (): Promise<void> =>
        stubLanguageModel(page, DOWNLOADABLE_MODEL_STUB));

      await test.step('AND the AI fill tab of the compared invoice is open', async (): Promise<void> => openInvoiceAiFill(page));
    });

    test('SCENARIO: the download progress shows before the fill completes', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API builds the prompt', async (): Promise<void> =>
        routeApi(page, AI_PROMPT_ROUTE, aiPromptMock().handler));

      await test.step('AND the API merges the answer', async (): Promise<void> => routeApi(page, MERGE_ROUTE, mergeMock().handler));

      await test.step('WHEN on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

      await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN half the model is shown downloaded', async (): Promise<void> => expectDownloadProgress(page, 50));

      await test.step('AND the download finishes', async (): Promise<void> => releaseModelDownload(page));

      await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));
    });
  });

  test.describe('GIVEN the fixture is too large for the on-device model', () => {
    test.beforeEach(async ({ page }): Promise<void> => {
      await test.step('GIVEN the Prompt API runs out of quota', async (): Promise<void> =>
        stubLanguageModel(page, TOO_SMALL_MODEL_STUB));

      await test.step('AND the AI fill tab of the compared invoice is open', async (): Promise<void> => openInvoiceAiFill(page));
    });

    test('SCENARIO: the quota error points to the local CLI', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API builds the prompt', async (): Promise<void> =>
        routeApi(page, AI_PROMPT_ROUTE, aiPromptMock().handler));

      await test.step('WHEN on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

      await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

      await test.step('THEN the notice names the size limit and the CLI', async (): Promise<void> =>
        expectFillError(page, TOO_LARGE_ERROR));
    });
  });
});
