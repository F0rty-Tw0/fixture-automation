import type { AiToolsResult, DiffResult } from '@fixture-automation/fixture-studio-api/contract';
import type { Page } from '@playwright/test';

import { openAiFillTab } from './ai-fill-panel.page.ts';
import { openCompareTab, pickExistingFixture } from './compare-panel.page.ts';
import { generate, toggleEndpoint } from './endpoints-step.page.ts';
import { loadSpecFromFile } from './spec-step.page.ts';
import { openStudioWithSpec } from './studio.page.ts';
import { PARTIAL_INVOICE_JSON_PATH } from '../common/fixture-file.const.ts';
import {
  AI_FILL_ROUTE,
  CLI_MODELS_ROUTE,
  CLI_TOOLS_ROUTE,
  DIFF_ROUTE,
  GENERATE_ROUTE,
  MERGE_ROUTE,
  SAMPLE_SPEC_PATH
} from '../common/playwright.const.ts';
import { generateMock } from '../mocks/studio-api.mock.ts';
import { aiFillMock, cliModelsMock, cliToolsMock, diffMock, mergeMock } from '../mocks/workbench.mock.ts';
import { INVOICE_ENDPOINT_STUB, SAMPLE_INVOICE_ENDPOINT_STUB } from '../stubs/studio-api.stub.ts';
import { AI_TOOLS_STUB, DIFF_RESULT_STUB } from '../stubs/workbench.stub.ts';
import { routeApi } from '../utils/route.spec.util.ts';

/** Arrange shared by compare scenarios: the invoice fixture generated and its Compare tab open. */
export const openInvoiceCompare = async (page: Page): Promise<void> => {
  await openStudioWithSpec(page);
  await routeApi(page, GENERATE_ROUTE, generateMock().handler);
  await toggleEndpoint(page, INVOICE_ENDPOINT_STUB);
  await generate(page);
  await openCompareTab(page);
};

/** Arrange shared by AI fill scenarios: the partial invoice compared, `diff` and the CLI install check answered, the AI fill tab open. */
export const openInvoiceAiFill = async (
  page: Page,
  diff: DiffResult = DIFF_RESULT_STUB,
  tools: AiToolsResult = AI_TOOLS_STUB
): Promise<void> => {
  await routeApi(page, DIFF_ROUTE, diffMock(diff).handler);
  await routeApi(page, CLI_TOOLS_ROUTE, cliToolsMock(tools).handler);
  await routeApi(page, CLI_MODELS_ROUTE, cliModelsMock().handler);
  await openInvoiceCompare(page);
  await pickExistingFixture(page, PARTIAL_INVOICE_JSON_PATH);
  await openAiFillTab(page);
};

/** Live arrange: the API's own sample spec loaded from its file and its invoice fixture generated. */
export const generateSampleInvoice = async (page: Page): Promise<void> => {
  await loadSpecFromFile(page, SAMPLE_SPEC_PATH);
  await toggleEndpoint(page, SAMPLE_INVOICE_ENDPOINT_STUB);
  await generate(page);
};

/** Every workbench route answered with its happy-path stub: diff, CLI install check, CLI models, CLI fill, and merge. */
export const routeWorkbenchApi = async (page: Page): Promise<void> => {
  await routeApi(page, DIFF_ROUTE, diffMock().handler);
  await routeApi(page, CLI_TOOLS_ROUTE, cliToolsMock().handler);
  await routeApi(page, CLI_MODELS_ROUTE, cliModelsMock().handler);
  await routeApi(page, AI_FILL_ROUTE, aiFillMock().handler);
  await routeApi(page, MERGE_ROUTE, mergeMock().handler);
};
