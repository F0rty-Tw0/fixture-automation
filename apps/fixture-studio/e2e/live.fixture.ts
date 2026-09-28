import type { TestInfo } from '@playwright/test';

import { test as studioTest } from './studio.fixture.ts';
import { writeBigInvoice } from './test/utils/big-invoice.spec.util.ts';

type LiveFixtures = {
  /** A partial invoice over 5 MB, written into this test's output folder, so it is never committed. */
  readonly bigInvoicePath: string;
};

type UsePath = (path: string) => Promise<void>;

// Playwright reads a fixture's dependencies from this destructuring; this one has none.
// eslint-disable-next-line no-empty-pattern
const writeBigInvoiceFile = async ({}: object, use: UsePath, testInfo: TestInfo): Promise<void> => {
  const path = testInfo.outputPath('big-invoice.json');

  await writeBigInvoice(path);
  await use(path);
};

/** Live tests talk to the real API, which runs with `STUDIO_AI_MOCK=1`: no AI CLI is ever called. */
export const test = studioTest.extend<LiveFixtures>({ bigInvoicePath: writeBigInvoiceFile });
