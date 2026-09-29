import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { schemaChildren } from './schema-children.util.ts';
import { isSchemaRecord } from './schema-record.util.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

const pointerToken = (token: string): string => {
  const hasInvalidEscape = /~(?:[^01]|$)/.test(token);

  if (hasInvalidEscape) throw new Error(`invalid JSON Pointer token "${token}"`);

  return token.replaceAll('~1', '/').replaceAll('~0', '~');
};

const referenceTokens = (reference: string): string[] => {
  let decoded: string;

  try {
    decoded = decodeURIComponent(reference);
  } catch {
    throw new Error(`invalid schema reference "${reference}"`);
  }

  const isPointer = decoded.startsWith('#/');

  if (!isPointer) throw new Error(`unsupported local schema reference "${reference}"`);

  return decoded.slice(2).split('/').map(pointerToken);
};

const pointerValue = (root: unknown, tokens: string[]): unknown => {
  let current: unknown = root;

  for (const token of tokens) {
    if (isSchemaRecord(current)) {
      const hasToken = Object.hasOwn(current, token);

      if (!hasToken) return undefined;

      current = current[token];
      continue;
    }

    if (Array.isArray(current)) {
      const index = Number(token);
      const isInteger = Number.isInteger(index);
      const isArrayIndex = isInteger && index >= 0 && `${index}` === token;

      if (!isArrayIndex) return undefined;

      current = current[index];
      continue;
    }

    return undefined;
  }

  return current;
};

export const schemaReferences = (schema: unknown, dialect: SchemaDialect): string[] => {
  if (!isSchemaRecord(schema)) return [];

  const references: string[] = [];
  const reference = schema['$ref'];

  if (typeof reference === 'string') references.push(reference);

  const ignoresReferenceSiblings = dialect !== 'openapi-31' && typeof reference === 'string';

  if (ignoresReferenceSiblings) return references;

  if (dialect === 'openapi-31') {
    const dynamicReference = schema['$dynamicRef'];

    if (typeof dynamicReference === 'string') references.push(dynamicReference);
  }

  for (const child of schemaChildren(schema)) {
    const childReferences = schemaReferences(child, dialect);

    references.push(...childReferences);
  }

  return references;
};

export const pointerReferenceName = (reference: string, spec: OpenApiSpec): string => {
  const tokens = referenceTokens(reference);
  const target = pointerValue(spec, tokens);

  if (target === undefined) throw new Error(`unresolved schema reference "${reference}"`);

  const [components, schemas, schemaName] = tokens;
  const hasSchemaPrefix = components === 'components' && schemas === 'schemas' && schemaName !== undefined;

  if (!hasSchemaPrefix) throw new Error(`unsupported local schema reference "${reference}"`);

  return schemaName;
};
