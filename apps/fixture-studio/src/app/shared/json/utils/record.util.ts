export const isRecord = (value: unknown): value is Record<string, unknown> => {
  const isObject = typeof value === 'object' && value !== null;

  return isObject && !Array.isArray(value);
};
