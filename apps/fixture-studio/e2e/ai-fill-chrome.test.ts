import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';

import { expect, test } from './mocked-api.fixture.ts';
import { AI_PROMPT_ROUTE, MERGE_ROUTE } from './test/common/playwright.const.ts';
import type { AiFillOptions, LanguageModelStubConfig } from './test/common/playwright.type.ts';
import { aiPromptMock, mergeMock } from './test/mocks/workbench.mock.ts';
import {
  chromeOptIn,
  downloadModel,
  expectAvailability,
  expectDownloadProgress,
  expectFillDisabled,
  expectFillError,
  expectLogLine,
  expectModelReady,
  expectNoModelYet,
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
import { expectPromptCalls, releaseModelDownload } from './test/utils/language-model.spec.util.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

type AvailabilityCase = {
  readonly config: LanguageModelStubConfig;
  readonly label: string;
  readonly provider: string;
};

const AVAILABILITY_CASES: AvailabilityCase[] = [
  { config: AVAILABLE_MODEL_STUB, label: 'Ready', provider: 'On-device Chrome AI' },
  { config: DOWNLOADABLE_MODEL_STUB, label: 'Model not downloaded yet', provider: 'On-device Chrome AI' },
  { config: DOWNLOADING_MODEL_STUB, label: 'Downloading the model', provider: 'On-device Chrome AI' },
  { config: UNAVAILABLE_MODEL_STUB, label: 'Not available in this browser', provider: 'Local CLI' }
];

const SENT_PROMPT = { endpointId: INVOICE_ENDPOINT_STUB.id, fixture: PARTIAL_INVOICE_STUB, missing: MISSING_FILE_STUB };

const SENT_MERGE = {
  endpointId: INVOICE_ENDPOINT_STUB.id,
  fixture: PARTIAL_INVOICE_STUB,
  populated: POPULATED_STUB,
  original: PARTIAL_INVOICE_STUB
};

const CONSTRAINED_PROMPT = { input: AI_PROMPT_STUB.prompt, hasResponseConstraint: true };

const TOO_LARGE_ERROR: ApiErrorBody = {
  message: 'This fixture is too large for the on-device model.',
  fix: 'Turn off "Use on-device Chrome AI" to fill it with the local CLI instead.'
};

const FILLED_COUNT = MISSING_FILE_STUB.paths.length;

/** The stubbed model streams this answer in two chunks; the log shows it as one block. */
const STREAMED_ANSWER = JSON.stringify(POPULATED_STUB);

test.describe('FEATURE: AI fill with on-device Chrome AI', () => {
  for (const availabilityCase of AVAILABILITY_CASES) {
    const { availability } = availabilityCase.config;

    test(`GIVEN Chrome reports the model ${availability}, opting in reads "${availabilityCase.label}"`, async ({
      page
    }): Promise<void> => {
      const options: AiFillOptions = { model: availabilityCase.config };

      await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
        openInvoiceAiFill(page, options));

      await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

      await test.step('THEN the availability is labelled', async (): Promise<void> =>
        expectAvailability(page, availabilityCase.label));

      await test.step('AND the provider follows it', async (): Promise<void> => expectProvider(page, availabilityCase.provider));
    });
  }

  test('GIVEN an available model, an opted-in fill runs on the device, not through the CLI', async ({ page }): Promise<void> => {
    const prompt = aiPromptMock();
    const merge = mergeMock();
    const routes = [apiRoute(AI_PROMPT_ROUTE, prompt), apiRoute(MERGE_ROUTE, merge)];
    const options: AiFillOptions = { model: AVAILABLE_MODEL_STUB, routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('AND the prompt was built for the missing paths', (): void => expect(prompt.bodies).toEqual([SENT_PROMPT]));

    await test.step('AND the model was prompted with the response schema', async (): Promise<void> =>
      expectPromptCalls(page, [CONSTRAINED_PROMPT]));

    await test.step('AND the streamed chunks were merged as one answer', (): void => expect(merge.bodies).toEqual([SENT_MERGE]));

    await test.step('AND the log shows the streamed answer as one block', async (): Promise<void> =>
      expectLogLine(page, STREAMED_ANSWER));
  });

  test('GIVEN an available model, the opt-in survives a reload', async ({ page }): Promise<void> => {
    const options: AiFillOptions = { model: AVAILABLE_MODEL_STUB };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

    await test.step('AND the studio is opened again at AI fill', async (): Promise<void> => openInvoiceAiFill(page));

    await test.step('THEN the opt-in is still checked', async (): Promise<void> => expect(chromeOptIn(page)).toBeChecked());

    await test.step('AND the provider is on-device Chrome AI', async (): Promise<void> => expectProvider(page, 'On-device Chrome AI'));
  });

  test('GIVEN a model still to download, it is downloaded on its own, then the missing values are filled', async ({
    page
  }): Promise<void> => {
    const routes = [apiRoute(AI_PROMPT_ROUTE, aiPromptMock()), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { model: DOWNLOADABLE_MODEL_STUB, routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

    await test.step('THEN it says there is no model yet', async (): Promise<void> => expectNoModelYet(page));

    await test.step('AND the fill waits for the model', async (): Promise<void> => expectFillDisabled(page));

    await test.step('WHEN the model is downloaded', async (): Promise<void> => downloadModel(page));

    await test.step('THEN half the model is shown downloaded', async (): Promise<void> => expectDownloadProgress(page, 50));

    await test.step('WHEN the download finishes', async (): Promise<void> => releaseModelDownload(page));

    await test.step('THEN the model is ready', async (): Promise<void> => expectModelReady(page));

    await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));
  });

  test('GIVEN a fixture over the on-device quota, the quota error points to the local CLI', async ({ page }): Promise<void> => {
    const routes = [apiRoute(AI_PROMPT_ROUTE, aiPromptMock())];
    const options: AiFillOptions = { model: TOO_SMALL_MODEL_STUB, routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the notice names the size limit and the CLI', async (): Promise<void> =>
      expectFillError(page, TOO_LARGE_ERROR));
  });
});
