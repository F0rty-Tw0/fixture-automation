import { describe, expect, it } from 'vitest';

import { unknownFormats } from './schema-format.util.ts';

describe('FEATURE: unknown schema format collection', (): void => {
  describe('GIVEN a prepared document mixing known and unknown formats', (): void => {
    it('WHEN collecting unknown formats THEN it returns unique names in sorted order', (): void => {
      const created = { type: 'integer', format: 'unix-time' };
      const currency = { type: 'string', format: 'currency' };
      const id = { type: 'string', format: 'uuid' };
      const invoiceProperties = { created, currency, id };
      const invoice = { type: 'object', properties: invoiceProperties };
      const amount = { type: 'string', format: 'decimal' };
      const due = { type: 'integer', format: 'unix-time' };
      const lineProperties = { amount, due };
      const line = { type: 'object', properties: lineProperties };
      const schemas = { Invoice: invoice, Line: line };
      const components = { schemas };
      const document = { $ref: '#/components/schemas/Invoice', components };

      expect(unknownFormats(document)).toStrictEqual(['currency', 'decimal', 'unix-time']);
    });
  });

  describe('GIVEN unknown formats nested below array and composition keywords', (): void => {
    it('WHEN collecting unknown formats THEN it descends into every subschema', (): void => {
      const branch = { type: 'string', format: 'iban' };
      const items = { anyOf: [branch] };
      const lines = { type: 'array', items };
      const schemas = { Lines: lines };
      const components = { schemas };
      const document = { components };

      expect(unknownFormats(document)).toStrictEqual(['iban']);
    });
  });

  describe('GIVEN a document without component schemas', (): void => {
    it('WHEN collecting unknown formats THEN it returns an empty list', (): void => {
      const knownFormat = { type: 'string', format: 'email' };
      const emptyComponents = {};
      const emptyDocument = { components: emptyComponents };

      expect(unknownFormats(undefined)).toStrictEqual([]);
      expect(unknownFormats(emptyDocument)).toStrictEqual([]);
      expect(unknownFormats(knownFormat)).toStrictEqual([]);
    });
  });

  describe('GIVEN a non-string format annotation', (): void => {
    it('WHEN collecting unknown formats THEN it ignores the annotation', (): void => {
      const schema = { type: 'string', format: 12 };

      expect(unknownFormats(schema)).toStrictEqual([]);
    });
  });
});
