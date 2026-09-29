import { describe, expect, it } from 'vitest';

import { parseMissingFile } from './missing-file.util.ts';

const STATUS_SCHEMA = { type: 'string' };
const PROPERTIES = { status: STATUS_SCHEMA };
const PROJECTION = { type: 'object', required: ['status'], properties: PROPERTIES };
const INVOICE_SCHEMA = { type: 'object' };
const SCHEMAS = { invoice: INVOICE_SCHEMA };
const COMPONENTS = { schemas: SCHEMAS };
const LIST_COMPONENTS = { schemas: [] };
const VALID = { schemaName: 'invoice', dialect: 'openapi-30', paths: ['status'], schema: PROJECTION, components: COMPONENTS };

const patchedFile = (patch: Record<string, unknown>): string => {
  const merged = { ...VALID, ...patch };

  return JSON.stringify(merged);
};

describe('FEATURE: missing-field file contract', (): void => {
  describe('GIVEN a diff-produced missing.json payload', (): void => {
    it('WHEN the payload is complete THEN returns the typed missing file', (): void => {
      const parsed = parseMissingFile(JSON.stringify(VALID));

      expect(parsed.schemaName).toBe('invoice');
      expect(parsed.dialect).toBe('openapi-30');
      expect(parsed.paths).toStrictEqual(['status']);
      expect(parsed.schema).toStrictEqual(PROJECTION);
      expect(parsed.components.schemas['invoice']).toStrictEqual(INVOICE_SCHEMA);
    });

    it('WHEN the diff found nothing THEN still parses an empty path list', (): void => {
      const empty = patchedFile({ paths: [] });

      expect(parseMissingFile(empty).paths).toStrictEqual([]);
    });

    it('WHEN the text is not JSON THEN rejects before generation', (): void => {
      expect((): unknown => parseMissingFile('{not JSON')).toThrow(Error);
    });

    it.each([
      ['a non-object payload', '[]'],
      ['a blank schema name', patchedFile({ schemaName: '' })],
      ['an unknown dialect', patchedFile({ dialect: 'draft-04' })],
      ['a non-string path', patchedFile({ paths: [1] })],
      ['no path list', patchedFile({ paths: undefined })],
      ['a non-object projection', patchedFile({ schema: 'object' })],
      ['no components', patchedFile({ components: undefined })],
      ['a non-object schema map', patchedFile({ components: LIST_COMPONENTS })]
    ])('WHEN the payload has %s THEN rejects before generation', (_case: string, text: string): void => {
      expect((): unknown => parseMissingFile(text)).toThrow(/missing\.json/);
    });
  });
});
