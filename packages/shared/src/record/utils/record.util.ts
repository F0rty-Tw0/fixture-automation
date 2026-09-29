/** Whether `value` is a non-null, non-array object, so its keys can be read as a `Record`. */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};
