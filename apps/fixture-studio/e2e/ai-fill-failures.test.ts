import { expect, test } from './ai-fill.fixture.ts';
import { expectFillEnabled, expectNotRunning } from './test/pages/ai-fill-form.page.ts';
import { cancelFill, expectFillError, expectLogLine, fillMissingValues } from './test/pages/ai-fill-panel.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import { NO_RESULT_ERROR_STUB } from './test/stubs/ai-fill-failure.stub.ts';
import { PROGRESS_EVENT_STUB } from './test/stubs/workbench.stub.ts';
import { ndjsonOf } from './test/utils/ndjson.spec.util.ts';

const PROGRESS_LINE = ndjsonOf([PROGRESS_EVENT_STUB]);

test.describe('FEATURE: AI fill failures', () => {
  test('GIVEN a CLI stream that closes without a result, the notice says so and Fill can run again', async ({
    cliStream,
    page
  }): Promise<void> => {
    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> => openInvoiceAiFill(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the CLI reports progress', async (): Promise<void> => cliStream.write(PROGRESS_LINE));

    await test.step('AND the CLI closes the stream', async (): Promise<void> => cliStream.end());

    await test.step('THEN the notice says the stream ended without a result', async (): Promise<void> =>
      expectFillError(page, NO_RESULT_ERROR_STUB));

    await test.step('AND no fill is running', async (): Promise<void> => expectNotRunning(page));

    await test.step('AND Fill is offered again', async (): Promise<void> => expectFillEnabled(page));
  });

  test('GIVEN a running CLI fill, cancel stops it and Fill starts a new request', async ({ cliStream, page }): Promise<void> => {
    const requestCount = (): number => cliStream.bodies.length;

    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> => openInvoiceAiFill(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the CLI reports progress', async (): Promise<void> => cliStream.write(PROGRESS_LINE));

    await test.step('THEN the progress line is logged', async (): Promise<void> => expectLogLine(page, PROGRESS_EVENT_STUB.text));

    await test.step('WHEN the run is cancelled', async (): Promise<void> => cancelFill(page));

    await test.step('THEN the log says it was cancelled', async (): Promise<void> => expectLogLine(page, 'Cancelled.'));

    await test.step('AND no fill is running', async (): Promise<void> => expectNotRunning(page));

    await test.step('AND Fill is offered again', async (): Promise<void> => expectFillEnabled(page));

    await test.step('WHEN the missing values are filled again', async (): Promise<void> => fillMissingValues(page));

    await test.step('THEN a second request reaches the CLI', async (): Promise<void> => expect.poll(requestCount).toBe(2));
  });
});
