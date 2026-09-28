import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { escapeRegExp } from '../utils/regexp.spec.util.ts';

const endpointsRegion = (page: Page): Locator => page.getByRole('region', { name: 'Endpoints' });

/** A row's checkbox is named `METHOD /path summary-or-reason`. */
const endpointCheckbox = (page: Page, endpoint: Endpoint): Locator => {
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

  await expect(rows).toHaveText(patterns);
};

/** Disabled, and named by the reason it cannot be sampled instead of its summary. */
export const expectUnsupported = async (page: Page, endpoint: Endpoint): Promise<void> => {
  const name = `${endpoint.method} ${endpoint.path} ${endpoint.unsupportedReason ?? ''}`;
  const checkbox = endpointsRegion(page).getByRole('checkbox', { disabled: true, exact: true, name });

  await expect(checkbox).toBeVisible();
};

export const expectEndpointChecked = async (page: Page, endpoint: Endpoint, isChecked: boolean): Promise<void> => {
  const checkbox = endpointCheckbox(page, endpoint);

  await expect(checkbox).toBeChecked({ checked: isChecked });
};

export const expectEndpointFocused = async (page: Page, endpoint: Endpoint): Promise<void> => {
  const checkbox = endpointCheckbox(page, endpoint);

  await expect(checkbox).toBeFocused();
};

export const expectSelectionSummary = async (page: Page, summary: string): Promise<void> => {
  const counter = endpointsRegion(page).getByText(/selected ·/u);

  await expect(counter).toHaveText(summary);
};

export const expectFormatError = async (page: Page, message: string): Promise<void> => {
  const alert = endpointsRegion(page).getByRole('alert');

  await expect(alert).toHaveText(message);
};
