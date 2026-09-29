import { fullFormats } from 'ajv-formats/dist/formats.js';

import { schemaChildren } from './schema-children.util.ts';
import { isSchemaRecord } from './schema-record.util.ts';

function* schemaFormats(schema: unknown): Generator<string> {
  if (!isSchemaRecord(schema)) return;

  const format = schema['format'];

  if (typeof format === 'string') yield format;

  for (const child of schemaChildren(schema)) yield* schemaFormats(child);
}

function* documentSchemas(root: unknown): Generator<unknown> {
  if (!isSchemaRecord(root)) return;

  yield root;

  const components = root['components'];

  if (!isSchemaRecord(components)) return;

  const schemas = components['schemas'];

  if (isSchemaRecord(schemas)) yield* Object.values(schemas);
}

/** Collect the distinct `format` names in a prepared schema document that ajv-formats does not define. */
export const unknownFormats = (root: unknown): string[] => {
  const collected = new Set<string>();

  for (const schema of documentSchemas(root)) {
    for (const format of schemaFormats(schema)) {
      const isKnownFormat = Object.hasOwn(fullFormats, format);

      if (!isKnownFormat) collected.add(format);
    }
  }

  const found = [...collected];
  const names = found.toSorted();

  return names;
};
