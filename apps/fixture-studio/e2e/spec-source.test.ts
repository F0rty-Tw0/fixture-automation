import { expect, test } from './mocked-api.fixture.ts';
import { NOT_JSON_PATH } from './test/common/fixture-file.const.ts';
import { SAMPLE_SPEC_PATH, SPECS_ROUTE } from './test/common/playwright.const.ts';
import type { ElementBox } from './test/common/playwright.type.ts';
import { specsMock } from './test/mocks/studio-api.mock.ts';
import {
  expectFileRejected,
  expectSourceLayout,
  expectSpecLoaded,
  expectUrlRequired,
  loadSpecFromFile,
  loadSpecFromUrl,
  openStudio,
  submitSpecUrl
} from './test/pages/spec-step.page.ts';
import { SPEC_URL } from './test/pages/studio.page.ts';
import { LOADED_SPEC_STUB } from './test/stubs/studio-api.stub.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

test.describe('FEATURE: spec source', () => {
  test('GIVEN no spec url, pressing Load spec flags it without moving the page', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page));

    const before = await test.step('AND Load spec is pressed with no url', async (): Promise<ElementBox[]> => submitSpecUrl(page));

    await test.step('THEN the url is flagged as required', async (): Promise<void> => expectUrlRequired(page));

    await test.step('AND neither the drop zone nor the next step moved', async (): Promise<void> => expectSourceLayout(page, before));
  });

  test('GIVEN the API serves the billing spec, a spec url lists its endpoints', async ({ page }): Promise<void> => {
    const specs = specsMock();
    const routes = [apiRoute(SPECS_ROUTE, specs)];
    const sentUrl = { url: SPEC_URL };

    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page, { routes }));

    await test.step('AND a spec url is loaded', async (): Promise<void> => loadSpecFromUrl(page, SPEC_URL));

    await test.step('THEN the spec is shown', async (): Promise<void> => expectSpecLoaded(page, LOADED_SPEC_STUB.title));

    await test.step('AND the url was sent to the API', (): void => expect(specs.bodies).toEqual([sentUrl]));
  });

  test('GIVEN the API serves the billing spec, a local JSON file is sent as a document', async ({ page }): Promise<void> => {
    const specs = specsMock();
    const routes = [apiRoute(SPECS_ROUTE, specs)];
    const sampleInfo = { title: 'Studio API', version: '2.1.0' };
    const sentDocument = { document: expect.objectContaining({ info: sampleInfo }) };

    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page, { routes }));

    await test.step('AND the sample spec file is picked', async (): Promise<void> => loadSpecFromFile(page, SAMPLE_SPEC_PATH));

    await test.step('THEN the spec is shown', async (): Promise<void> => expectSpecLoaded(page, LOADED_SPEC_STUB.title));

    await test.step('AND the parsed file was sent as the document', (): void => expect(specs.bodies).toEqual([sentDocument]));
  });

  test('GIVEN a file that is not JSON, it is rejected in the browser', async ({ page }): Promise<void> => {
    await test.step('WHEN the studio is opened', async (): Promise<void> => openStudio(page));

    await test.step('AND the broken JSON file is picked', async (): Promise<void> => loadSpecFromFile(page, NOT_JSON_PATH));

    await test.step('THEN the file is rejected', async (): Promise<void> =>
      expectFileRejected(page, 'not-json.json is not valid JSON.'));
  });
});
