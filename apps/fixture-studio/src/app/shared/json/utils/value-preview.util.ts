const ELLIPSIS = '…';

/** A fixture value on one line for a list: its JSON, cut to `limit` characters. */
export const valuePreview = (value: unknown, limit: number): string => {
  if (value === undefined) return 'undefined';

  const json = JSON.stringify(value);

  if (json.length <= limit) return json;

  const head = json.slice(0, limit - 1);

  return `${head}${ELLIPSIS}`;
};
