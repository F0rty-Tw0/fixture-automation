import type { Page } from '@playwright/test';

import { fillMissingValues } from './ai-fill-panel.page.ts';
import { pickExistingFixture } from './compare-panel.page.ts';
import { generate, toggleEndpoint } from './endpoints-step.page.ts';
import { continueToAiFill } from './missing-values-step.page.ts';
import { loadSpecFromFile } from './spec-step.page.ts';
import { openStudioWithSpec } from './studio.page.ts';
import { PARTIAL_INVOICE_JSON_PATH } from '../common/fixture-file.const.ts';
import {
  AI_FILL_ROUTE,
  CLI_MODELS_ROUTE,
  CLI_TOOLS_ROUTE,
  DIFF_ROUTE,
  ENVELOPE_ROUTE,
  GENERATE_ROUTE,
  MERGE_ROUTE,
  SAMPLE_SPEC_PATH
} from '../common/playwright.const.ts';
import type { AiFillOptions, ApiRoute, RecordingRoute, StudioOptions } from '../common/playwright.type.ts';
import { generateMock } from '../mocks/studio-api.mock.ts';
import { aiFillMock, cliModelsMock, cliToolsMock, diffMock, envelopeMock, mergeMock } from '../mocks/workbench.mock.ts';
import { CUSTOMER_ENDPOINT_STUB, INVOICE_ENDPOINT_STUB, SAMPLE_INVOICE_ENDPOINT_STUB } from '../stubs/studio-api.stub.ts';
import { BROKEN_DIFF_RESULT_STUB } from '../stubs/workbench.stub.ts';
import { optInToChromeAi } from '../utils/ai-settings.spec.util.ts';
import { stubLanguageModel } from '../utils/language-model.spec.util.ts';
import { apiRoute, routeApi } from '../utils/route.spec.util.ts';

/**
 * Arrange shared by compare scenarios: the invoice fixture generated, so its Compare step is the active one. The envelope
 * detection finds none unless the options' routes, routed after these defaults so they answer first, say otherwise.
 */
export const openInvoiceCompare = async (page: Page, options: StudioOptions = {}): Promise<void> => {
  await routeApi(page, ENVELOPE_ROUTE, envelopeMock().handler);
  await routeApi(page, GENERATE_ROUTE, generateMock().handler);
  await openStudioWithSpec(page, options);
  await toggleEndpoint(page, INVOICE_ENDPOINT_STUB);
  await generate(page);
};

/** Arrange for the Generate workspace: the invoice and the customer generated from the billing spec; the invoice is active. */
export const generateInvoiceAndCustomer = async (page: Page, options: StudioOptions = {}): Promise<void> => {
  await openStudioWithSpec(page, options);
  await routeApi(page, GENERATE_ROUTE, generateMock().handler);
  await toggleEndpoint(page, INVOICE_ENDPOINT_STUB);
  await toggleEndpoint(page, CUSTOMER_ENDPOINT_STUB);
  await generate(page);
};

/** Arrange for per-endpoint state: the invoice and the customer generated, each compare answered by `diff`; the invoice is active. */
export const openTwoEndpointCompare = async (page: Page, diff: RecordingRoute): Promise<void> => {
  const routes = [apiRoute(ENVELOPE_ROUTE, envelopeMock()), apiRoute(DIFF_ROUTE, diff)];
  const options: StudioOptions = { routes };

  await generateInvoiceAndCustomer(page, options);
};

/** Arrange shared by AI fill scenarios: the partial invoice compared, the diff and the CLI install check answered, the AI fill step open. */
export const openInvoiceAiFill = async (page: Page, options: AiFillOptions = {}): Promise<void> => {
  const routes = options.routes ?? [];
  const compareOptions: StudioOptions = { routes };

  if (options.model !== undefined) await stubLanguageModel(page, options.model);

  if (options.isChromeAiOptedIn === true) await optInToChromeAi(page);

  await routeApi(page, DIFF_ROUTE, diffMock(options.diff).handler);
  await routeApi(page, CLI_TOOLS_ROUTE, cliToolsMock(options.tools).handler);
  await routeApi(page, CLI_MODELS_ROUTE, cliModelsMock().handler);
  await openInvoiceCompare(page, compareOptions);
  await pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH);
  await continueToAiFill(page);
};

/** Every step holding its content: the invoice with a broken value compared, filled by the CLI and merged. */
export const fillBrokenInvoice = async (page: Page): Promise<void> => {
  const routes = [apiRoute(AI_FILL_ROUTE, aiFillMock()), apiRoute(MERGE_ROUTE, mergeMock())];
  const options: AiFillOptions = { diff: BROKEN_DIFF_RESULT_STUB, routes };

  await openInvoiceAiFill(page, options);
  await fillMissingValues(page);
};

/** Live arrange: the API's own sample spec loaded from its file and its invoice fixture generated. */
export const generateSampleInvoice = async (page: Page): Promise<void> => {
  await loadSpecFromFile(page, SAMPLE_SPEC_PATH);
  await toggleEndpoint(page, SAMPLE_INVOICE_ENDPOINT_STUB);
  await generate(page);
};

/** Every workbench route answered with its happy-path stub: envelope, diff, CLI install check, CLI models, CLI fill, and merge. */
export const workbenchRoutes = (): ApiRoute[] => {
  const routes = [
    apiRoute(ENVELOPE_ROUTE, envelopeMock()),
    apiRoute(DIFF_ROUTE, diffMock()),
    apiRoute(CLI_TOOLS_ROUTE, cliToolsMock()),
    apiRoute(CLI_MODELS_ROUTE, cliModelsMock()),
    apiRoute(AI_FILL_ROUTE, aiFillMock()),
    apiRoute(MERGE_ROUTE, mergeMock())
  ];

  return routes;
};
