import type { Page, Route } from '@playwright/test';

import { test as mockedApiTest } from './mocked-api.fixture.ts';
import { AI_FILL_ROUTE } from './test/common/playwright.const.ts';
import type { NdjsonStream } from './test/common/playwright.type.ts';
import { startNdjsonStream } from './test/utils/ndjson-stream.spec.util.ts';

type AiFillFixtures = {
  readonly cliStream: NdjsonStream;
};

type StreamArgs = {
  readonly page: Page;
};

type UseStream = (stream: NdjsonStream) => Promise<void>;

/**
 * `page.route` can only fulfill a whole body, so `ai-fill` is forwarded to a real local server: the browser
 * then receives each chunk the test writes, and a cancel closes a real connection.
 */
const serveCliStream = async ({ page }: StreamArgs, use: UseStream): Promise<void> => {
  const stream = await startNdjsonStream();
  const forward = async (route: Route): Promise<void> => route.continue({ url: stream.url });

  await page.route(AI_FILL_ROUTE, forward);
  await use(stream);
  await stream.close();
};

export const test = mockedApiTest.extend<AiFillFixtures>({ cliStream: serveCliStream });

export { expect } from './mocked-api.fixture.ts';
