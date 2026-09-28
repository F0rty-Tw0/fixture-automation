const UNITS = ['B', 'KB', 'MB'];

/** Human-readable size of a text, counting UTF-16 code units as bytes (sources are ASCII-heavy). */
export const formatSize = (text: string): string => {
  let size = text.length;
  let unit = 0;

  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const digits = unit === 0 ? 0 : 1;

  return `${size.toFixed(digits)} ${UNITS[unit] ?? ''}`;
};

export const mimeTypeOf = (fileName: string): string => {
  const isJson = fileName.endsWith('.json');

  return isJson ? 'application/json' : 'text/plain';
};
