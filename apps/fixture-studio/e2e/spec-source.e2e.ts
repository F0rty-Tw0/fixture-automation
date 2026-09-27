import { expect, test } from './mocked-api.fixture.ts';
import { NOT_JSON_PATH } from './test/common/fixture-file.const.ts';
import { SAMPLE_SPEC_PATH, SPECS_ROUTE } from './test/common/playwright.const.ts';
import type { ElementBox } from './test/common/playwright.type.ts';
import { apiErrorMock, specsMock, unreachableMock } from './test/mocks/studio-api.mock.ts';
import {
  expectApiError,
  expectFileRejected,
  expectSpecLoaded,
  expectUrlRequired,
  loadSpecFromFile,
  loadSpecFromUrl,
  openStudio,
  sourceLayout,
  submitSpecUrl
} from './test/pages/spec-step.page.ts';
import { SPEC_URL } from './test/pages/studio.page.ts';
import { LOADED_SPEC_STUB, SPEC_ERROR_STUB, UNREACHABLE_ERROR_STUB } from './test/stubs/studio-api.stub.ts';
import { routeApi } from './test/utils/route.spec.util.ts';

test.describe('FEATURE: spec source', () => {
  test.beforeEach(async ({ page }): Promise<void> => {
    await test.step('GIVEN the studio is open', async (): Promise<void> => openStudio(page));
  });

  test('SCENARIO: a missing url is flagged without moving the page', async ({ page }): Promise<void> => {
    const before = await test.step('GIVEN the source row is measured', async (): Promise<ElementBox[]> => sourceLayout(page));

    await test.step('WHEN Load spec is pressed with no url', async (): Promise<void> => submitSpecUrl(page));

    await expectUrlRequired(page);

    await test.step('AND neither the drop zone nor the next step moved', async (): Promise<void> =>
      expect(await sourceLayout(page)).toEqual(before));
  });

  test.describe('GIVEN the API loads specs', () => {
    test('SCENARIO: a spec url lists its endpoints', async ({ page }): Promise<void> => {
      const specs = specsMock();

      await test.step('GIVEN the API answers with the billing spec', async (): Promise<void> =>
        routeApi(page, SPECS_ROUTE, specs.handler));

      await test.step('WHEN a spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

      await test.step('THEN the spec is shown', async (): Promise<void> => expectSpecLoaded(page, LOADED_SPEC_STUB.title));

      await test.step('AND the url was sent to the API', (): void => expect(specs.bodies).toEqual([{ url: SPEC_URL }]));
    });

    test('SCENARIO: a local JSON file is sent as a document', async ({ page }): Promise<void> => {
      const specs = specsMock();
      const sampleInfo = { title: 'Studio API', version: '2.1.0' };
      const sentDocument = { document: expect.objectContaining({ info: sampleInfo }) };

      await test.step('GIVEN the API answers with the billing spec', async (): Promise<void> =>
        routeApi(page, SPECS_ROUTE, specs.handler));

      await test.step('WHEN the sample spec file is picked', async (): Promise<void> => loadSpecFromFile(page, SAMPLE_SPEC_PATH));

      await test.step('THEN the spec is shown', async (): Promise<void> => expectSpecLoaded(page, LOADED_SPEC_STUB.title));

      await test.step('AND the parsed file was sent as the document', (): void => expect(specs.bodies).toEqual([sentDocument]));
    });

    test('SCENARIO: a file that is not JSON is rejected in the browser', async ({ page }): Promise<void> => {
      await test.step('WHEN a broken JSON file is picked', async (): Promise<void> => loadSpecFromFile(page, NOT_JSON_PATH));

      await test.step('THEN the file is rejected', async (): Promise<void> =>
        expectFileRejected(page, 'not-json.json is not valid JSON.'));
    });
  });

  test.describe('GIVEN the API refuses the spec', () => {
    test.use({ allowedConsoleErrors: [/status of 422/u] });

    test('SCENARIO: the error body message and fix are shown', async ({ page }): Promise<void> => {
      await test.step('GIVEN the API answers 422 with an error body', async (): Promise<void> =>
        routeApi(page, SPECS_ROUTE, apiErrorMock()));

      await test.step('WHEN a spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

      await test.step('THEN the notice shows the API error', async (): Promise<void> => expectApiError(page, SPEC_ERROR_STUB));
    });
  });

  test.describe('GIVEN the API process is down', () => {
    test.use({ allowedConsoleErrors: [/status of 502/u] });

    test('SCENARIO: the notice says the API did not answer', async ({ page }): Promise<void> => {
      await test.step('GIVEN the dev proxy answers 502', async (): Promise<void> => routeApi(page, SPECS_ROUTE, unreachableMock()));

      await test.step('WHEN a spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

      await test.step('THEN the notice explains the API did not answer', async (): Promise<void> =>
        expectApiError(page, UNREACHABLE_ERROR_STUB));
    });
  });
});
