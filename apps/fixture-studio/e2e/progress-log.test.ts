import { test } from './ai-fill.fixture.ts';
import { fillMissingValues } from './test/pages/ai-fill-panel.page.ts';
import { expectLogEntries, expectLogFollowsNewest } from './test/pages/progress-log.page.ts';
import { openInvoiceAiFill } from './test/pages/workbench.page.ts';
import { POPULATED_STUB } from './test/stubs/workbench.stub.ts';
import { ndjsonOf } from './test/utils/ndjson.spec.util.ts';
import { fragmentsOf, statusEvent, stdoutEvent } from './test/utils/progress-event.spec.util.ts';

/** A model's answer as a CLI streams it: a few characters per `stdout` event. */
const ANSWER = JSON.stringify(POPULATED_STUB);

const FRAGMENTS = fragmentsOf(ANSWER, 3);

const HALF = Math.ceil(FRAGMENTS.length / 2);

const FIRST_HALF = FRAGMENTS.slice(0, HALF);

const FIRST_HALF_NDJSON = ndjsonOf(FIRST_HALF.map(stdoutEvent));

const SECOND_HALF_NDJSON = ndjsonOf(FRAGMENTS.slice(HALF).map(stdoutEvent));

/** What the API streams for a fill split in two chunks: a status line, then that chunk's model output, twice. */
const MOCK_OUTPUT = ['mock: reading the missing schema\n', 'mock: sampling values\n', 'mock: done\n'];

const FIRST_CHUNK = 'Chunk 1 of 2: 1 field…';

const SECOND_CHUNK = 'Chunk 2 of 2: 1 field…';

const OUTPUT_EVENTS = MOCK_OUTPUT.map(stdoutEvent);

const CHUNKED_NDJSON = ndjsonOf([statusEvent(`${FIRST_CHUNK}\n`), ...OUTPUT_EVENTS, statusEvent(`${SECOND_CHUNK}\n`), ...OUTPUT_EVENTS]);

const OUTPUT_BLOCK = MOCK_OUTPUT.join('');

/** More status lines than the log box shows at once. */
const MANY_LINES = Array.from({ length: 120 }, (_value: unknown, index: number): string => `step ${index + 1} of the run`);

const MANY_NDJSON = ndjsonOf(MANY_LINES.map(statusEvent));

const LAST_LINE = 'the newest line';

test.describe('FEATURE: the AI progress log', () => {
  test('GIVEN a CLI answer streamed in fragments, the log grows it as one block', async ({ cliStream, page }): Promise<void> => {
    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> => openInvoiceAiFill(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the CLI streams the first half of its answer', async (): Promise<void> => cliStream.write(FIRST_HALF_NDJSON));

    await test.step('THEN the log shows those fragments as one entry', async (): Promise<void> =>
      expectLogEntries(page, [FIRST_HALF.join('')]));

    await test.step('WHEN the CLI streams the rest of its answer', async (): Promise<void> => cliStream.write(SECOND_HALF_NDJSON));

    await test.step('THEN the same entry holds the whole answer', async (): Promise<void> => expectLogEntries(page, [ANSWER]));
  });

  test('GIVEN a status line between two runs of output, the log splits them into separate blocks', async ({
    cliStream,
    page
  }): Promise<void> => {
    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> => openInvoiceAiFill(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the CLI streams two chunks, each a status line and its output', async (): Promise<void> =>
      cliStream.write(CHUNKED_NDJSON));

    await test.step('THEN each status line and each run of output is its own entry', async (): Promise<void> =>
      expectLogEntries(page, [FIRST_CHUNK, OUTPUT_BLOCK, SECOND_CHUNK, OUTPUT_BLOCK]));
  });

  test('GIVEN more lines than the log box shows, it scrolls inside and keeps the newest line in view', async ({
    cliStream,
    page
  }): Promise<void> => {
    await test.step('WHEN the AI fill step of the compared invoice is opened', async (): Promise<void> => openInvoiceAiFill(page));

    await test.step('AND the missing values are filled', async (): Promise<void> => fillMissingValues(page));

    await test.step('AND the CLI streams 120 status lines', async (): Promise<void> => cliStream.write(MANY_NDJSON));

    await test.step('THEN the log scrolls inside its box, at the newest line', async (): Promise<void> => expectLogFollowsNewest(page));

    await test.step('WHEN the CLI streams one more line', async (): Promise<void> =>
      cliStream.write(ndjsonOf([statusEvent(LAST_LINE)])));

    await test.step('THEN the log holds it last', async (): Promise<void> => expectLogEntries(page, [...MANY_LINES, LAST_LINE]));

    await test.step('AND it followed down to it', async (): Promise<void> => expectLogFollowsNewest(page));
  });
});
