import type { PlaywrightTestArgs, TestInfo } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

import { recordBrowserErrors, unexpectedErrors } from './test/utils/browser-errors.spec.util.ts';

type StudioFixtureOptions = {
  /** Console errors a scenario provokes on purpose, e.g. the network error of a mocked 502. */
  readonly allowedConsoleErrors: RegExp[];
};

type StudioFixtures = {
  readonly browserErrorGuard: undefined;
};

type GuardArgs = StudioFixtureOptions & PlaywrightTestArgs;

type UseGuard = (value: undefined) => Promise<void>;

const NO_ALLOWED_ERRORS: RegExp[] = [];

const OPTION = { option: true };

const AUTO = { auto: true };

const guardBrowserErrors = async ({ allowedConsoleErrors, page }: GuardArgs, use: UseGuard, testInfo: TestInfo): Promise<void> => {
  const errors = recordBrowserErrors(page);

  await use(undefined);

  const hasPassed = testInfo.status === testInfo.expectedStatus;
  const unexpected = unexpectedErrors(errors, allowedConsoleErrors);

  if (hasPassed) expect(unexpected, 'Unexpected browser errors').toEqual([]);
};

const allowedConsoleErrors: [RegExp[], typeof OPTION] = [NO_ALLOWED_ERRORS, OPTION];

const browserErrorGuard: [typeof guardBrowserErrors, typeof AUTO] = [guardBrowserErrors, AUTO];

/** Every studio test fails on an uncaught page error or an unexpected console error. */
export const test = base.extend<StudioFixtureOptions & StudioFixtures>({ allowedConsoleErrors, browserErrorGuard });

export { expect } from '@playwright/test';
