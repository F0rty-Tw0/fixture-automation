import type {
  BrokenValue,
  DiffResult,
  Endpoint,
  GenerateResult,
  GeneratedFixture,
  LoadedSpec
} from '@fixture-automation/fixture-studio-api/contract';

import { test } from './mocked-api.fixture.ts';
import { DIFF_ROUTE, ENVELOPE_ROUTE, GENERATE_ROUTE } from './test/common/playwright.const.ts';
import type { StudioOptions } from './test/common/playwright.type.ts';
import { generateMock } from './test/mocks/studio-api.mock.ts';
import { diffMock, envelopeMock } from './test/mocks/workbench.mock.ts';
import { pasteFixture } from './test/pages/compare-panel.page.ts';
import { generate, toggleEndpoint } from './test/pages/endpoints-step.page.ts';
import { expectMissingPaths } from './test/pages/missing-values-step.page.ts';
import { expectNoHorizontalOverflow, expectPageHeightWithin } from './test/pages/rail.page.ts';
import { openStudioWithSpec } from './test/pages/studio.page.ts';
import { expectEndpointTabs } from './test/pages/workspace-step.page.ts';
import { INVOICE_ENDPOINT_STUB, LOADED_SPEC_STUB } from './test/stubs/studio-api.stub.ts';
import { DIFF_RESULT_STUB, MISSING_FILE_STUB } from './test/stubs/workbench.stub.ts';
import { apiRoute } from './test/utils/route.spec.util.ts';

/** A path and a value far wider than any screen: each one alone would push a careless layout sideways. */
const LONG_SEGMENT = 'a-very-long-path-segment-that-never-wraps-'.repeat(8);

const WIDE_VALUE = 'x'.repeat(6000);

const WIDE_PATH = `/v1/${LONG_SEGMENT}/{id}`;

const WIDE_ENDPOINT: Endpoint = { ...INVOICE_ENDPOINT_STUB, id: `GET ${WIDE_PATH}`, path: WIDE_PATH };

const WIDE_SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, endpoints: [WIDE_ENDPOINT] };

/** Thousands of lines as well: a long fixture must scroll inside its editor, not stretch the page. */
const LINES = Array.from({ length: 4000 }, (_value: unknown, index: number): string => `line ${index}`);

const wideJson = JSON.stringify({ id: 'in_123', note: WIDE_VALUE, lines: LINES }, undefined, 2);

const WIDE_FIXTURE: GeneratedFixture = {
  endpointId: WIDE_ENDPOINT.id,
  schemaName: 'invoice',
  json: wideJson,
  stub: undefined,
  types: undefined
};

const WIDE_RESULT: GenerateResult = { fixtures: [WIDE_FIXTURE] };

const WIDE_MISSING_PATHS = [`${LONG_SEGMENT}.${LONG_SEGMENT}`, 'memo'];

const WIDE_MISSING = { ...MISSING_FILE_STUB, paths: WIDE_MISSING_PATHS };

const WIDE_BROKEN: BrokenValue = {
  path: LONG_SEGMENT,
  value: WIDE_VALUE,
  reason: `must be shorter than 50 characters ${LONG_SEGMENT}`
};

const placeholderAt = (index: number): BrokenValue => {
  const broken: BrokenValue = { path: `lines[${index}]`, value: 'string', reason: 'openapi-sampler placeholder' };

  return broken;
};

/** Two thousand broken values: their list scrolls inside itself instead of stretching the page. */
const MANY_BROKEN = Array.from({ length: 2000 }, (_value: unknown, index: number): BrokenValue => placeholderAt(index));

const WIDE_DIFF: DiffResult = {
  ...DIFF_RESULT_STUB,
  missing: WIDE_MISSING,
  missingPaths: WIDE_MISSING_PATHS,
  broken: [WIDE_BROKEN, ...MANY_BROKEN],
  completeJson: wideJson
};

const DESKTOP = { width: 1280, height: 900 };

const PHONE = { width: 390, height: 844 };

test.describe('FEATURE: long and wide fixtures', () => {
  test('GIVEN a very long path and a wide fixture, the page never scrolls sideways, wide or narrow', async ({
    page
  }): Promise<void> => {
    const routes = [
      apiRoute(GENERATE_ROUTE, generateMock(WIDE_RESULT)),
      apiRoute(ENVELOPE_ROUTE, envelopeMock()),
      apiRoute(DIFF_ROUTE, diffMock(WIDE_DIFF))
    ];
    const options: StudioOptions = { routes, spec: WIDE_SPEC, viewport: DESKTOP };

    await test.step('WHEN the studio is opened in a desktop-wide window', async (): Promise<void> =>
      openStudioWithSpec(page, options));

    await test.step('AND the long-path endpoint is selected', async (): Promise<void> => toggleEndpoint(page, WIDE_ENDPOINT));

    await test.step('AND generate is pressed', async (): Promise<void> => generate(page));

    await test.step('THEN its tab is shown', async (): Promise<void> => expectEndpointTabs(page, [WIDE_ENDPOINT.id]));

    await test.step('WHEN a wide fixture is pasted', async (): Promise<void> => pasteFixture(page, wideJson));

    await test.step('THEN the wide missing paths are listed', async (): Promise<void> => expectMissingPaths(page, WIDE_MISSING_PATHS));

    await test.step('AND at 1280px nothing overflows', async (): Promise<void> => expectNoHorizontalOverflow(page));

    await test.step('AND the 4000-line fixture and 2000 broken values scroll inside their boxes', async (): Promise<void> =>
      expectPageHeightWithin(page, 6));

    await test.step('WHEN the window is phone-narrow', async (): Promise<void> => page.setViewportSize(PHONE));

    await test.step('THEN at 390px nothing overflows either', async (): Promise<void> => expectNoHorizontalOverflow(page));
  });
});
