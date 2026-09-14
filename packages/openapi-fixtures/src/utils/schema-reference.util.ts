const SCHEMA_POINTER = '#/components/schemas/';

/** Decode a `#/components/schemas/<name>` pointer into the component name it selects. */
export const referenceName = (reference: string): string => {
  let decoded: string;

  try {
    decoded = decodeURIComponent(reference);
  } catch {
    throw new Error(`invalid schema reference "${reference}"`);
  }

  const isSchemaPointer = decoded.startsWith(SCHEMA_POINTER);

  if (!isSchemaPointer) throw new Error(`unsupported local schema reference "${reference}"`);

  const token = decoded.slice(SCHEMA_POINTER.length);

  return token.replaceAll('~1', '/').replaceAll('~0', '~');
};
