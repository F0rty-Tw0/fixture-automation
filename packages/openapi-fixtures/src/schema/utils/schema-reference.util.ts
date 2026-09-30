import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';

const SCHEMA_POINTER = '#/components/schemas/';

/** Decode a `#/components/schemas/<name>` pointer into the component name it selects. */
export const referenceName = (reference: string): string => {
  let decoded: string;

  try {
    decoded = decodeURIComponent(reference);
  } catch {
    throw new FixtureError(`invalid schema reference "${reference}"`, 'fix the percent escape in the $ref');
  }

  const isSchemaPointer = decoded.startsWith(SCHEMA_POINTER);

  if (!isSchemaPointer) {
    throw new FixtureError(`unsupported local schema reference "${reference}"`, 'point the $ref at #/components/schemas/<name>');
  }

  const token = decoded.slice(SCHEMA_POINTER.length);

  return token.replaceAll('~1', '/').replaceAll('~0', '~');
};

/** The fix for a `$ref` to component `name` that the spec does not declare. */
export const unresolvedReferenceFix = (name: string): string => {
  return `add components.schemas["${name}"] to the spec, or point the $ref at an existing schema`;
};
