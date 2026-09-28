import { expect, test } from './mocked-api.fixture.ts';
import { AI_FILL_ROUTE, AI_PROMPT_ROUTE, MERGE_ROUTE } from './test/common/playwright.const.ts';
import type { AiFillOptions } from './test/common/playwright.type.ts';
import { aiFillMock, aiPromptMock, mergeMock } from './test/mocks/workbench.mock.ts';
import { expectChromeUnavailable, expectFillEnabled, expectNoDownloadOffered } from './test/pages/ai-fill-form.page.ts';
import {
  downloadModel,
  expectFillDisabled,
  expectModelReady,
  expectNoModelYet,
  expectProvider,
  expectTooLargeForChromeAi,
  expectValidMerge,
  fillMissingValues,
  toggleChromeOptIn
} from './test/pages/ai-fill-panel.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import {
  AVAILABLE_MODEL_STUB,
  DOWNLOADABLE_MODEL_STUB,
  DOWNLOAD_CREATE_STUB,
  SESSION_CREATE_STUB,
  UNAVAILABLE_MODEL_STUB
} from './test/stubs/language-model.stub.ts';
import { MISSING_FILE_STUB, TOO_LARGE_FOR_CHROME_AI_DIFF_RESULT_STUB } from './test/stubs/workbench.stub.ts';
import { expectChromeAiOptInStored } from './test/utils/ai-settings.spec.util.ts';
import { expectModelCreates, releaseModelDownload } from './test/utils/language-model.spec.util.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

const FILLED_COUNT = MISSING_FILE_STUB.paths.length;

test.describe('FEATURE: on-device model states', () => {
  test('GIVEN a model still to download, nothing downloads until the user asks and Fill waits for it', async ({
    page
  }): Promise<void> => {
    const routes = [apiRoute(AI_PROMPT_ROUTE, aiPromptMock()), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { model: DOWNLOADABLE_MODEL_STUB, routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

    await test.step('THEN it says there is no model yet', async (): Promise<void> => expectNoModelYet(page));

    await test.step('AND Fill waits for the model', async (): Promise<void> => expectFillDisabled(page));

    await test.step('AND no model session was created', async (): Promise<void> => expectModelCreates(page, []));

    await test.step('WHEN the model download is asked for', async (): Promise<void> => downloadModel(page));

    await test.step('AND the download finishes', async (): Promise<void> => releaseModelDownload(page));

    await test.step('THEN the model is ready', async (): Promise<void> => expectModelReady(page));

    await test.step('AND the only create was the download', async (): Promise<void> =>
      expectModelCreates(page, [DOWNLOAD_CREATE_STUB]));

    await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('AND the fill created a session, not a second download', async (): Promise<void> =>
      expectModelCreates(page, [DOWNLOAD_CREATE_STUB, SESSION_CREATE_STUB]));
  });

  test('GIVEN an available model, Fill is enabled at once and fills in one session', async ({ page }): Promise<void> => {
    const routes = [apiRoute(AI_PROMPT_ROUTE, aiPromptMock()), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { model: AVAILABLE_MODEL_STUB, routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

    await test.step('THEN the model is ready', async (): Promise<void> => expectModelReady(page));

    await test.step('AND Fill is enabled', async (): Promise<void> => expectFillEnabled(page));

    await test.step('AND no download is offered', async (): Promise<void> => expectNoDownloadOffered(page));

    await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('AND the only create was the fill session', async (): Promise<void> =>
      expectModelCreates(page, [SESSION_CREATE_STUB]));
  });

  test('GIVEN Chrome AI cannot run here, the opt-in says so and the local CLI fills', async ({ page }): Promise<void> => {
    const fill = aiFillMock();
    const routes = [apiRoute(AI_FILL_ROUTE, fill), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = { model: UNAVAILABLE_MODEL_STUB, routes };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('AND on-device Chrome AI is opted in', async (): Promise<void> => toggleChromeOptIn(page));

    await test.step('THEN it says Chrome AI cannot run and the CLI fills', async (): Promise<void> => expectChromeUnavailable(page));

    await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('AND the CLI got the fill request', (): void => expect(fill.bodies).toHaveLength(1));

    await test.step('AND no model session was created', async (): Promise<void> => expectModelCreates(page, []));
  });

  test('GIVEN an opted-in user and a fixture too large for Chrome AI, the opt-in is hidden and the local CLI fills', async ({
    page
  }): Promise<void> => {
    const fill = aiFillMock();
    const routes = [apiRoute(AI_FILL_ROUTE, fill), apiRoute(MERGE_ROUTE, mergeMock())];
    const options: AiFillOptions = {
      diff: TOO_LARGE_FOR_CHROME_AI_DIFF_RESULT_STUB,
      isChromeAiOptedIn: true,
      model: AVAILABLE_MODEL_STUB,
      routes
    };

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> =>
      openInvoiceAiFill(page, options));

    await test.step('THEN the opt-in is hidden and the note says the fixture is too large', async (): Promise<void> =>
      expectTooLargeForChromeAi(page));

    await test.step('AND the provider is the local CLI', async (): Promise<void> => expectProvider(page, 'Local CLI'));

    await test.step('AND the user is still opted in', async (): Promise<void> => expectChromeAiOptInStored(page));

    await test.step('WHEN the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN the merge is valid', async (): Promise<void> => expectValidMerge(page, FILLED_COUNT));

    await test.step('AND the CLI got the fill request', (): void => expect(fill.bodies).toHaveLength(1));

    await test.step('AND no model session was created', async (): Promise<void> => expectModelCreates(page, []));
  });
});
