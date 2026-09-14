import { Ajv } from 'ajv';
import type { AnySchema, ValidateFunction } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvDraft4 from 'ajv-draft-04';
import addFormats from 'ajv-formats';

import { unknownFormats } from './schema-format.util.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

const validatorOptions = {
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  strict: false,
  strictNumbers: true,
  useDefaults: false,
  validateFormats: true
};

const newValidator = (dialect: SchemaDialect): Ajv => {
  if (dialect === 'draft-07') return new Ajv(validatorOptions);

  if (dialect === 'openapi-30') return new ajvDraft4.default(validatorOptions);

  return new Ajv2020(validatorOptions);
};

export const compileFixtureSchema = <TFixture>(schema: AnySchema, dialect: SchemaDialect): ValidateFunction<TFixture> => {
  const validator = newValidator(dialect);

  addFormats.default(validator);

  // ponytail: unknown formats accept anything; add real validators per format if a fixture ever needs it.
  for (const format of unknownFormats(schema)) validator.addFormat(format, true);

  return validator.compile<TFixture>(schema);
};
