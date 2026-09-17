import { describe, expect, it } from 'vitest';

import { missingDocument } from './missing-document.util.ts';
import type { MissingFile } from '../common/missing.type.ts';
import { SCHEMA_IDENTIFIER } from '../common/schema-identifier.const.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

const STATUS_SCHEMA = { type: 'string' };
const PROJECTION_PROPERTIES = { status: STATUS_SCHEMA };
const PROJECTION = { type: 'object', required: ['status'], properties: PROJECTION_PROPERTIES };
const INVOICE_SCHEMA = { type: 'object' };
const SCHEMAS = { invoice: INVOICE_SCHEMA };
const COMPONENTS = { schemas: SCHEMAS };
const EMPTY_COMPONENTS = { schemas: {} };
const MISSING_FILE: MissingFile = {
  components: COMPONENTS,
  dialect: 'openapi-31',
  paths: ['status'],
  schema: PROJECTION,
  schemaName: 'invoice'
};
const MISSING_REFERENCE = '#/components/schemas/missing';

describe('FEATURE: missing-field schema document', (): void => {
  describe('GIVEN a missing file with pruned components', (): void => {
    describe('WHEN building the document', (): void => {
      const document = missingDocument(MISSING_FILE);

      it('THEN points at the missing component beside the pruned schemas', (): void => {
        const expectedSchemas = { invoice: INVOICE_SCHEMA, missing: PROJECTION };
        const expectedComponents = { schemas: expectedSchemas };
        const expected = { $schema: SCHEMA_IDENTIFIER['openapi-31'], $ref: MISSING_REFERENCE, components: expectedComponents };

        expect(document).toStrictEqual(expected);
      });

      it('THEN leaves the source components untouched', (): void => {
        expect(MISSING_FILE.components.schemas).toStrictEqual(SCHEMAS);
      });
    });
  });

  describe('GIVEN a missing file without components', (): void => {
    it('WHEN building the document THEN holds only the missing component', (): void => {
      const file: MissingFile = { ...MISSING_FILE, components: EMPTY_COMPONENTS };
      const expectedSchemas = { missing: PROJECTION };
      const expectedComponents = { schemas: expectedSchemas };
      const expected = { $schema: SCHEMA_IDENTIFIER['openapi-31'], $ref: MISSING_REFERENCE, components: expectedComponents };

      const document = missingDocument(file);

      expect(document).toStrictEqual(expected);
    });
  });

  describe('GIVEN each supported dialect', (): void => {
    it.each<SchemaDialect>(['draft-07', 'openapi-30', 'openapi-31'])(
      'WHEN the dialect is %s THEN declares its schema identifier',
      (dialect: SchemaDialect): void => {
        const file: MissingFile = { ...MISSING_FILE, dialect };

        const document = missingDocument(file);

        expect(document).toMatchObject({ $schema: SCHEMA_IDENTIFIER[dialect] });
      }
    );
  });
});
