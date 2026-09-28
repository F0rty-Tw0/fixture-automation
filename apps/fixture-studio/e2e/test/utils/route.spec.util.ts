import type { Page } from '@playwright/test';

import type { ApiRoute, RecordingRoute, RouteHandler } from '../common/playwright.type.ts';

/** `page.route` resolves to a `Disposable`; a step needs a plain `Promise<void>`. */
export const routeApi = async (page: Page, pattern: string, handler: RouteHandler): Promise<void> => {
  await page.route(pattern, handler);
};

export const apiRoute = (pattern: string, recording: RecordingRoute): ApiRoute => {
  const route: ApiRoute = { pattern, handler: recording.handler };

  return route;
};

/** Routes each scenario route in order; a later route answers before an earlier one for the same URL. */
export const routeAll = async (page: Page, routes: ApiRoute[]): Promise<void> => {
  for (const route of routes) await page.route(route.pattern, route.handler);
};
