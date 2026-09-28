import type { PlaywrightTestArgs, TestInfo } from '@playwright/test';

import { expect, test as studioTest } from './studio.fixture.ts';
import { API_ROUTE_PATTERN } from './test/common/playwright.const.ts';
import { unmockedApiMock } from './test/mocks/studio-api.mock.ts';

type MockedApiFixtures = {
  readonly unmockedApiGuard: undefined;
};

type UseGuard = (value: undefined) => Promise<void>;

const AUTO = { auto: true };

const guardUnmockedApi = async ({ page }: PlaywrightTestArgs, use: UseGuard, testInfo: TestInfo): Promise<void> => {
  const unmockedUrls: string[] = [];

  await page.route(API_ROUTE_PATTERN, unmockedApiMock(unmockedUrls));
  await use(undefined);

  const hasPassed = testInfo.status === testInfo.expectedStatus;

  if (hasPassed) expect(unmockedUrls, 'API calls without a mock').toEqual([]);
};

const unmockedApiGuard: [typeof guardUnmockedApi, typeof AUTO] = [guardUnmockedApi, AUTO];

/**
 * Mocked-project tests never reach a real API: every `/api` call is answered by a scenario mock,
 * and one without a mock fails the test. Scenario mocks are routed later, so Playwright tries them first.
 */
export const test = studioTest.extend<MockedApiFixtures>({ unmockedApiGuard });

export { expect } from './studio.fixture.ts';
