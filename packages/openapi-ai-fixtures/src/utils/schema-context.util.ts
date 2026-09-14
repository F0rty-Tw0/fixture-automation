import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { schemaDialect } from './schema-dialect.util.ts';
import { schemaDocument } from './schema-document.util.ts';
import { schemaGraph } from './schema-graph.util.ts';
import { compileFixtureSchema } from './schema-validator.util.ts';
import type { PreparedSchema } from '../common/schema.type.ts';

export const prepareSchema = <TFixture = Record<string, unknown>>(spec: OpenApiSpec, name: string): PreparedSchema<TFixture> => {
  const dialect = schemaDialect(spec.openapi, spec.jsonSchemaDialect);
  const schemas = schemaGraph(spec, name, dialect);
  const document = schemaDocument(schemas, name, dialect);
  const context = JSON.stringify(document);

  const validate = compileFixtureSchema<TFixture>(document, dialect);
  const prepared: PreparedSchema<TFixture> = { context, validate };

  return prepared;
};
