import { isSchemaRecord } from '../../utils/schema-record.util.ts';

export const schemaFixtureUrl = (name: string): URL => {
  const url = new URL(`../fixtures/schema-dialect/${name}`, import.meta.url);

  return url;
};

export const schemaNames = (context: string): string[] => {
  const document: unknown = JSON.parse(context);
  const isDocument = isSchemaRecord(document);

  if (!isDocument) throw new Error('schema context must be an object');

  const components = document['components'];
  const isComponents = isSchemaRecord(components);

  if (!isComponents) throw new Error('schema context must include components');

  const schemas = components['schemas'];
  const isSchemas = isSchemaRecord(schemas);

  if (!isSchemas) throw new Error('schema context must include schemas');

  return Object.keys(schemas).sort();
};
