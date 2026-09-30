const JSON_START = /[[{]/u;

/** The parsed value, or `undefined` when the text is not JSON. */
export const parseJsonOrUndefined = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const spanOf = (text: string, start: number, end: number): unknown => {
  if (start < 0 || end < start) return undefined;

  return parseJsonOrUndefined(text.slice(start, end + 1));
};

/**
 * JSON a model wrapped in a Markdown fence or prose: the text itself when it parses, otherwise the span from the first
 * `{` or `[` to the last `}` or `]`, otherwise the span from the first `{` to the last `}` (prose like `[note] {…}`).
 * `undefined` when none parses.
 */
export const parseEmbeddedJson = (text: string): unknown => {
  const whole = parseJsonOrUndefined(text);

  if (whole !== undefined) return whole;

  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  const widest = spanOf(text, text.search(JSON_START), end);

  if (widest !== undefined) return widest;

  return spanOf(text, text.indexOf('{'), text.lastIndexOf('}'));
};
