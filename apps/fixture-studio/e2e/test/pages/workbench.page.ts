import type { AiToolsResult, DiffResult } from '@fixture-automation/fixture-studio-api/contract';
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
import type { ApiRoute, LanguageModelStubConfig, RecordingRoute } from '../common/playwright.type.ts';
import { generateMock } from '../mocks/studio-api.mock.ts';
import { aiFillMock, cliModelsMock, cliToolsMock, diffMock, envelopeMock, mergeMock } from '../mocks/workbench.mock.ts';
import { CUSTOMER_ENDPOINT_STUB, INVOICE_ENDPOINT_STUB, SAMPLE_INVOICE_ENDPOINT_STUB } from '../stubs/studio-api.stub.ts';
import { AI_TOOLS_STUB, BROKEN_DIFF_RESULT_STUB, DIFF_RESULT_STUB } from '../stubs/workbench.stub.ts';
import { stubLanguageModel } from '../utils/language-model.spec.util.ts';
import { apiRoute, routeAll, routeApi } from '../utils/route.spec.util.ts';

/**
 * Arrange shared by compare scenarios: the invoice fixture generated, so its Compare step is the active one. The envelope
 * detection finds none unless `routes` (routed last, so they answer first) or a scenario routes its own answer after this.
 */
export const openInvoiceCompare = async (page: Page, routes: ApiRoute[] = []): Promise<void> => {
  await routeApi(page, ENVELOPE_ROUTE, envelopeMock().handler);
  await openStudioWithSpec(page);
  await routeApi(page, GENERATE_ROUTE, generateMock().handler);
  await toggleEndpoint(page, INVOICE_ENDPOINT_STUB);
  await generate(page);
  await routeAll(page, routes);
};

/** Arrange for per-endpoint state: the invoice and the customer generated, each compare answered by `diff`; the invoice is active. */
export const openTwoEndpointCompare = async (page: Page, diff: RecordingRoute): Promise<void> => {
  await routeApi(page, ENVELOPE_ROUTE, envelopeMock().handler);
  await routeApi(page, DIFF_ROUTE, diff.handler);
  await openStudioWithSpec(page);
  await routeApi(page, GENERATE_ROUTE, generateMock().handler);
  await toggleEndpoint(page, INVOICE_ENDPOINT_STUB);
  await toggleEndpoint(page, CUSTOMER_ENDPOINT_STUB);
  await generate(page);
};

/** Arrange shared by AI fill scenarios: the partial invoice compared, `diff` and the CLI install check answered, the AI fill step open. */
export const openInvoiceAiFill = async (
  page: Page,
  diff: DiffResult = DIFF_RESULT_STUB,
  tools: AiToolsResult = AI_TOOLS_STUB,
  routes: ApiRoute[] = []
): Promise<void> => {
  await routeApi(page, DIFF_ROUTE, diffMock(diff).handler);
  await routeApi(page, CLI_TOOLS_ROUTE, cliToolsMock(tools).handler);
  await routeApi(page, CLI_MODELS_ROUTE, cliModelsMock().handler);
  await openInvoiceCompare(page, routes);
  await pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH);
  await continueToAiFill(page);
};

/** The AI fill step open with Chrome's Prompt API scripted by `model`, before the app loads. */
export const openInvoiceAiFillOnDevice = async (page: Page, model: LanguageModelStubConfig, routes: ApiRoute[]): Promise<void> => {
  await stubLanguageModel(page, model);
  await openInvoiceAiFill(page, DIFF_RESULT_STUB, AI_TOOLS_STUB, routes);
};

/** Every step holding its content: the invoice with a broken value compared, filled by the CLI and merged. */
export const fillBrokenInvoice = async (page: Page): Promise<void> => {
  const routes = [apiRoute(AI_FILL_ROUTE, aiFillMock()), apiRoute(MERGE_ROUTE, mergeMock())];

  await openInvoiceAiFill(page, BROKEN_DIFF_RESULT_STUB, AI_TOOLS_STUB, routes);
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

export const routeWorkbenchApi = async (page: Page): Promise<void> => routeAll(page, workbenchRoutes());
