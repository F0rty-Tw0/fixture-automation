import type { Page } from '@playwright/test';

import type { RouteHandler } from '../common/playwright.type.ts';

/** `page.route` resolves to a `Disposable`; a step needs a plain `Promise<void>`. */
export const routeApi = async (page: Page, pattern: string, handler: RouteHandler): Promise<void> => {
  await page.route(pattern, handler);
};
