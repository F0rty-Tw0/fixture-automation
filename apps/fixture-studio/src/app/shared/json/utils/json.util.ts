/** The parsed value, or `undefined` when the text is not JSON. */
export const parseJsonOrUndefined = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
