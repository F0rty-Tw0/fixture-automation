import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';

const TRUNCATION_MARK = '…';

/** The last `limit` characters of `text`, marked as cut when anything was dropped. */
const tailOf = (text: string, limit: number): string => {
  if (text.length <= limit) return text;

  const tail = text.slice(text.length - limit);

  return `${TRUNCATION_MARK}${tail}`;
};

/** Appends a line and drops the oldest ones beyond `limit`. */
const appendCapped = (lines: AiFillProgressEvent[], line: AiFillProgressEvent, limit: number): AiFillProgressEvent[] => {
  const appended = [...lines, line];
  const overflow = Math.max(appended.length - limit, 0);

  return appended.slice(overflow);
};

/**
 * Adds one progress event to the log. Consecutive `stdout` events are the model's answer arriving in fragments, so they
 * grow one entry, as a chat shows a streamed reply; that entry keeps only its last `blockLimit` characters. Status and
 * stderr lines stay entries of their own, without the newline they arrive with.
 */
export const appendProgress = (
  lines: AiFillProgressEvent[],
  event: AiFillProgressEvent,
  lineLimit: number,
  blockLimit: number
): AiFillProgressEvent[] => {
  const last = lines.at(-1);
  const isOutput = event.stream === 'stdout';

  if (isOutput && last?.stream === 'stdout') {
    const text = tailOf(`${last.text}${event.text}`, blockLimit);
    const grown: AiFillProgressEvent = { ...last, text };
    const earlier = lines.slice(0, -1);

    return [...earlier, grown];
  }

  const outputText = tailOf(event.text, blockLimit);
  const lineText = event.text.trimEnd();
  const text = isOutput ? outputText : lineText;
  const line: AiFillProgressEvent = { ...event, text };

  return appendCapped(lines, line, lineLimit);
};
