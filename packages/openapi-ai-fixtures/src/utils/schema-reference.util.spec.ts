import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { pointerReferenceName, schemaReferences } from './schema-reference.util.ts';
import { OPENAPI_SPEC_STUB } from '../test/stubs/openapi-spec.stub.ts';

const MONEY_REFERENCE = { $ref: '#/components/schemas/Money' };
const STATUS_REFERENCE = { $ref: '#/components/schemas/Status' };
const PROPERTIES = { total: MONEY_REFERENCE };
const REFERENCE_WITH_SIBLINGS = { $ref: '#/components/schemas/Base', properties: PROPERTIES };
const DYNAMIC = { $dynamicRef: '#node', properties: PROPERTIES };
const ALL_OF = [MONEY_REFERENCE, STATUS_REFERENCE];
const NESTED = { type: 'object', properties: PROPERTIES, allOf: ALL_OF };
const INVOICE = { type: 'object', allOf: ALL_OF } as const;
const SCHEMAS = { invoice: INVOICE, 'a/b~c': INVOICE, 'a b': INVOICE };
const COMPONENTS = { schemas: SCHEMAS };
const INFO = { title: 'Billing' };
const SPEC: OpenApiSpec = { ...OPENAPI_SPEC_STUB, components: COMPONENTS, info: INFO };

describe('FEATURE: schema reference discovery', (): void => {
  describe('GIVEN a non-object schema', (): void => {
    it('WHEN collecting references THEN yields nothing', (): void => {
      expect(schemaReferences(true, 'openapi-31')).toStrictEqual([]);
    });
  });

  describe('GIVEN a schema without references', (): void => {
    it('WHEN collecting references THEN yields nothing', (): void => {
      expect(schemaReferences({ type: 'string' }, 'openapi-31')).toStrictEqual([]);
    });
  });

  describe('GIVEN references below properties and allOf', (): void => {
    it('WHEN collecting THEN lists every reference in traversal order', (): void => {
      const expected = ['#/components/schemas/Money', '#/components/schemas/Status', '#/components/schemas/Money'];

      expect(schemaReferences(NESTED, 'openapi-31')).toStrictEqual(expected);
    });
  });

  describe('GIVEN a $ref with sibling keywords', (): void => {
    it('WHEN the dialect is openapi-31 THEN collects the siblings too', (): void => {
      const expected = ['#/components/schemas/Base', '#/components/schemas/Money'];

      expect(schemaReferences(REFERENCE_WITH_SIBLINGS, 'openapi-31')).toStrictEqual(expected);
    });

    it.each(['draft-07', 'openapi-30'] as const)('WHEN the dialect is %s THEN ignores the siblings', (dialect): void => {
      expect(schemaReferences(REFERENCE_WITH_SIBLINGS, dialect)).toStrictEqual(['#/components/schemas/Base']);
    });
  });

  describe('GIVEN a $dynamicRef', (): void => {
    it('WHEN the dialect is openapi-31 THEN collects it before the children', (): void => {
      expect(schemaReferences(DYNAMIC, 'openapi-31')).toStrictEqual(['#node', '#/components/schemas/Money']);
    });

    it('WHEN the dialect is draft-07 THEN ignores it', (): void => {
      expect(schemaReferences(DYNAMIC, 'draft-07')).toStrictEqual(['#/components/schemas/Money']);
    });
  });

  describe('GIVEN a component schema pointer', (): void => {
    it('WHEN the target exists THEN returns the schema name', (): void => {
      expect(pointerReferenceName('#/components/schemas/invoice', SPEC)).toBe('invoice');
    });

    it('WHEN the pointer is percent-encoded THEN decodes it', (): void => {
      expect(pointerReferenceName('#/components/schemas/a%20b', SPEC)).toBe('a b');
    });

    it('WHEN the pointer escapes slashes and tildes THEN unescapes them', (): void => {
      expect(pointerReferenceName('#/components/schemas/a~1b~0c', SPEC)).toBe('a/b~c');
    });

    it('WHEN the pointer descends into the schema THEN returns the owning schema name', (): void => {
      expect(pointerReferenceName('#/components/schemas/invoice/allOf/1', SPEC)).toBe('invoice');
    });
  });

  describe('GIVEN a pointer that does not resolve', (): void => {
    it.each([
      ['an unknown schema', '#/components/schemas/Missing'],
      ['a non-numeric array index', '#/components/schemas/invoice/allOf/x'],
      ['a zero-padded array index', '#/components/schemas/invoice/allOf/01'],
      ['a negative array index', '#/components/schemas/invoice/allOf/-1'],
      ['a token below a primitive', '#/info/title/x']
    ])('WHEN the pointer has %s THEN throws unresolved', (_case: string, reference: string): void => {
      expect((): unknown => pointerReferenceName(reference, SPEC)).toThrow(`unresolved schema reference "${reference}"`);
    });
  });

  describe('GIVEN a pointer outside the component schemas', (): void => {
    it.each([
      ['the info title', '#/info/title'],
      ['the schema map itself', '#/components/schemas'],
      ['a plain fragment', '#invoice']
    ])('WHEN the pointer targets %s THEN throws unsupported', (_case: string, reference: string): void => {
      expect((): unknown => pointerReferenceName(reference, SPEC)).toThrow(`unsupported local schema reference "${reference}"`);
    });
  });

  describe('GIVEN a malformed pointer', (): void => {
    it('WHEN a token has an invalid tilde escape THEN throws naming the token', (): void => {
      const resolve = (): unknown => pointerReferenceName('#/components/schemas/a~2b', SPEC);

      expect(resolve).toThrow('invalid JSON Pointer token "a~2b"');
    });

    it('WHEN the encoding is malformed THEN throws naming the reference', (): void => {
      const resolve = (): unknown => pointerReferenceName('#/components/schemas/%E0%A4%A', SPEC);

      expect(resolve).toThrow('invalid schema reference "#/components/schemas/%E0%A4%A"');
    });
  });
});
