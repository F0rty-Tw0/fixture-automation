/** Keys `line_000` to `line_<count - 1>`, one per line of the pretty-printed fixture. */
const keyedLines = (count: number): [string, string][] => {
  const entryAt = (_value: unknown, index: number): [string, string] => [`line_${String(index).padStart(3, '0')}`, `value ${index}`];

  return Array.from({ length: count }, entryAt);
};

/** Pretty JSON as the studio shows it: two-space indent and a closing newline. */
const prettyOf = (entries: [string, string][]): string => `${JSON.stringify(Object.fromEntries(entries), undefined, 2)}\n`;

/** A long fixture, as pasted into Compare. */
export const longFixtureJson = (count: number): string => prettyOf(keyedLines(count));

/** The same fixture with `added` inserted, each `[key, value]` right after the line key it names, so each is its own change. */
export const longCompleteJson = (count: number, added: Map<string, [string, string]>): string => {
  const withAdded = (entry: [string, string]): [string, string][] => {
    const insert = added.get(entry[0]);

    if (insert === undefined) return [entry];

    return [entry, insert];
  };

  return prettyOf(keyedLines(count).flatMap(withAdded));
};
