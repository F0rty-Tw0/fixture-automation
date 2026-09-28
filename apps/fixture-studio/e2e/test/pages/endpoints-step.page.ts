import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { escapeRegExp } from '../utils/regexp.spec.util.ts';

const endpointsRegion = (page: Page): Locator => page.getByRole('region', { name: 'Endpoints' });

/** A row's checkbox is named `METHOD /path summary-or-reason`. */
export const endpointCheckbox = (page: Page, endpoint: Endpoint): Locator => {
  const rows = endpointsRegion(page).getByRole('listitem');

  return rows.getByRole('checkbox', { name: `${endpoint.method} ${endpoint.path}` });
};

export const selectAllCheckbox = (page: Page): Locator => endpointsRegion(page).getByRole('checkbox', { name: 'Select all visible' });

export const generateButton = (page: Page): Locator => endpointsRegion(page).getByRole('button', { name: /^Generate/u });

const chooseOption = async (page: Page, select: string, option: string): Promise<void> => {
  await endpointsRegion(page).getByRole('combobox', { name: select }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
};

export const filterByQuery = async (page: Page, query: string): Promise<void> => {
  await endpointsRegion(page).getByRole('searchbox', { name: 'Filter by path or summary' }).fill(query);
};

export const filterByTag = async (page: Page, tag: string): Promise<void> => chooseOption(page, 'Tag', tag);

export const filterByMethod = async (page: Page, method: string): Promise<void> => chooseOption(page, 'Method', method);

export const toggleEndpoint = async (page: Page, endpoint: Endpoint): Promise<void> => {
  await endpointCheckbox(page, endpoint).click();
};

export const selectAllVisible = async (page: Page): Promise<void> => {
  await selectAllCheckbox(page).click();
};

export const toggleFormat = async (page: Page, label: string): Promise<void> => {
  await endpointsRegion(page).getByRole('group', { name: 'Formats' }).getByRole('checkbox', { name: label }).click();
};

export const toggleRequiredOnly = async (page: Page): Promise<void> => {
  await endpointsRegion(page).getByRole('switch', { name: 'Required fields only' }).click();
};

export const generate = async (page: Page): Promise<void> => {
  await generateButton(page).click();
};

/** The row's text runs badge, path, and detail together; only their order is asserted. */
const rowPattern = (endpoint: Endpoint): RegExp => {
  const detail = endpoint.unsupportedReason ?? endpoint.summary ?? '';
  const texts = [endpoint.method, endpoint.path, detail];
  const parts = texts.map(escapeRegExp);

  return new RegExp(`^${parts.join(String.raw`\s*`)}$`, 'u');
};

/** Rows in display order: grouped by tag, each row reading `METHOD /path summary-or-reason`. */
export const expectVisibleEndpoints = async (page: Page, endpoints: Endpoint[]): Promise<void> => {
  const rows = endpointsRegion(page).getByRole('listitem');
  const patterns = endpoints.map(rowPattern);
  const ids = endpoints.map((endpoint: Endpoint): string => endpoint.id);

  await test.step(`THEN the list shows exactly ${ids.join(', ')}`, async (): Promise<void> => expect(rows).toHaveText(patterns), {
    box: true
  });
};

/** Disabled, and named by the reason it cannot be sampled instead of its summary. */
export const expectUnsupported = async (page: Page, endpoint: Endpoint): Promise<void> => {
  const name = `${endpoint.method} ${endpoint.path} ${endpoint.unsupportedReason ?? ''}`;
  const checkbox = endpointsRegion(page).getByRole('checkbox', { disabled: true, exact: true, name });

  await test.step(`THEN ${endpoint.id} is disabled with its reason`, async (): Promise<void> => expect(checkbox).toBeVisible(), {
    box: true
  });
};

export const expectSelectionSummary = async (page: Page, summary: string): Promise<void> => {
  const counter = endpointsRegion(page).getByText(/selected ·/u);

  await test.step(`THEN the counter reads "${summary}"`, async (): Promise<void> => expect(counter).toHaveText(summary), {
    box: true
  });
};

export const expectFormatError = async (page: Page, message: string): Promise<void> => {
  const alert = endpointsRegion(page).getByRole('alert');

  await test.step(`THEN the options explain "${message}"`, async (): Promise<void> => expect(alert).toHaveText(message), {
    box: true
  });
};
