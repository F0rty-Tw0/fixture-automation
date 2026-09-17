import { describe, expect, it } from 'vitest';

import { missingDocument, missingStub, missingTypes } from './missing-output.util.ts';
import type { FixtureDiff } from '../common/missing.type.ts';
import type { SpecSchema } from '../common/schema.type.ts';

const TEXT_SCHEMA: SpecSchema = { type: 'string' };
const CUSTOMER_REF: SpecSchema = { $ref: '#/components/schemas/customer' };
const CUSTOMER_PROPERTIES = { email: TEXT_SCHEMA };
const CUSTOMER_SCHEMA: SpecSchema = { type: 'object', required: ['email'], properties: CUSTOMER_PROPERTIES };
const MISSING_PROPERTIES = { id: TEXT_SCHEMA, customer: CUSTOMER_REF };
const MISSING_SCHEMA: SpecSchema = { type: 'object', required: ['id', 'customer'], properties: MISSING_PROPERTIES };
const SCHEMAS = { customer: CUSTOMER_SCHEMA };
const COMPONENTS = { schemas: SCHEMAS };
const NO_COMPONENTS = { schemas: {} };
const DIFF: FixtureDiff = {
  schemaName: 'order',
  dialect: 'openapi-30',
  paths: ['id', 'customer'],
  schema: MISSING_SCHEMA,
  components: COMPONENTS
};
const DOCUMENT_INFO = { title: 'missing', version: '0' };
const DOCUMENT_SCHEMAS = { missing: MISSING_SCHEMA, customer: CUSTOMER_SCHEMA };
const DOCUMENT_COMPONENTS = { schemas: DOCUMENT_SCHEMAS };
const MISSING_DOCUMENT = { openapi: '3.1.0', info: DOCUMENT_INFO, components: DOCUMENT_COMPONENTS };
const MISSING_ALIAS = "export type Missing = components['schemas']['missing'];";

describe('FEATURE: missing-field output artifacts', (): void => {
  describe('GIVEN a diff whose projection references a component', (): void => {
    it('WHEN building the document THEN it is a 3.1 document holding the projection and the component', (): void => {
      const missingDoc = missingDocument(DIFF);

      expect(missingDoc).toStrictEqual(MISSING_DOCUMENT);
    });

    it('WHEN generating the types THEN the source ends with the Missing alias', async (): Promise<void> => {
      const missingDoc = missingDocument(DIFF);

      const types = await missingTypes(missingDoc);

      expect(types).toContain('customer:');
      expect(types.endsWith(`\n${MISSING_ALIAS}\n`)).toBe(true);
    });

    it('WHEN building the stub THEN it imports the types relative to the stub and samples through the reference', (): void => {
      const missingDoc = missingDocument(DIFF);

      const stub = missingStub(DIFF, missingDoc, '/out/missing.stub.ts', '/out/missing.d.ts');

      expect(stub).toContain('import type { components } from "./missing.d.ts";');
      expect(stub).toContain('export const MISSING_STUB: components["schemas"]["missing"] = {');
      expect(stub).toContain('"email": "string"');
    });
  });

  describe('GIVEN a diff without components', (): void => {
    it('WHEN building the document THEN only the projection is listed', (): void => {
      const diff: FixtureDiff = { ...DIFF, components: NO_COMPONENTS };
      const expected = { missing: MISSING_SCHEMA };

      const missingDoc = missingDocument(diff);

      expect(missingDoc).toHaveProperty('components.schemas', expected);
    });
  });
});
