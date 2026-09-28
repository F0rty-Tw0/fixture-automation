import { writeFile } from 'node:fs/promises';

/**
 * The size class that once failed: request bodies over the old 4 MiB limit, and prompts over one CLI answer. The browser
 * sends the fixture as compact JSON, so that is the size checked.
 */
const MIN_BYTES = 5 * 1024 * 1024;

/**
 * A root-level string the prompt keeps as context (about 315 KB): the whole prompt is over the 256 KiB chunk budget,
 * and each path alone stays under the 1 MiB CLI limit, so the API fills `memo` and `customer` in two chunks.
 */
const NOTE = 'Paid in two parts after the second reminder. '.repeat(7000);

const REMINDER = 'Reminder sent to the billing contact about the open balance. '.repeat(40);

type HistoryEntry = {
  readonly at: string;
  readonly note: string;
};

const historyAt = (_value: unknown, index: number): HistoryEntry => {
  const day = String((index % 28) + 1).padStart(2, '0');
  const entry: HistoryEntry = { at: `2026-01-${day}`, note: `#${index} ${REMINDER}` };

  return entry;
};

/**
 * Writes a partial invoice of the sample spec, over 5 MB: `memo` and `customer` absent, and a long `history` the prompt
 * drops as context but the request body still carries.
 */
export const writeBigInvoice = async (path: string): Promise<void> => {
  const history = Array.from({ length: 2200 }, historyAt);
  const invoice = { id: 'in_big', amount_due: 1200, status: 'open', note: NOTE, history };
  const bodyBytes = JSON.stringify(invoice).length;

  if (bodyBytes < MIN_BYTES) throw new Error(`the big invoice sends only ${bodyBytes} bytes`);

  await writeFile(path, JSON.stringify(invoice, undefined, 2));
};
