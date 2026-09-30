import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';

import { reachableSchemas } from './reachable-schemas.util.ts';

const CUSTOMER_REF: JSONSchema7 = { $ref: '#/components/schemas/customer' };
const ADDRESS_REF: JSONSchema7 = { $ref: '#/components/schemas/address' };
const NODE_REF: JSONSchema7 = { $ref: '#/components/schemas/node' };
const TEXT: JSONSchema7 = { type: 'string' };

const CUSTOMER_PROPERTIES = { address: ADDRESS_REF };
const ADDRESS_PROPERTIES = { country: TEXT };
const NODE_PROPERTIES = { parent: NODE_REF };
const ROOT_PROPERTIES = { customer: CUSTOMER_REF };

const customer: JSONSchema7 = { type: 'object', properties: CUSTOMER_PROPERTIES };
const address: JSONSchema7 = { type: 'object', properties: ADDRESS_PROPERTIES };
const node: JSONSchema7 = { type: 'object', properties: NODE_PROPERTIES };
const root: JSONSchema7 = { type: 'object', properties: ROOT_PROPERTIES };
const EXTENSION: Record<string, unknown> = { 'x-example': CUSTOMER_REF };
const extended: JSONSchema7 = { type: 'object', ...EXTENSION };
const ghost: JSONSchema7 = { $ref: '#/components/schemas/ghost' };
const COUNTRY_REF: JSONSchema7 = { $ref: '#/components/schemas/address/properties/country' };
const ANCHOR_REF: JSONSchema7 = { $ref: '#home' };
const LOOSE_REF: JSONSchema7 = { $ref: '#nowhere' };
const ANCHOR_FIELDS = { $anchor: 'home', type: 'object' } as const;
const home: JSONSchema7 = ANCHOR_FIELDS;
const schemas = { customer, address, node, home, unrelated: TEXT };

describe('FEATURE: reachable component schemas', (): void => {
  describe('GIVEN a schema referencing a chain of components', (): void => {
    it('WHEN collecting THEN returns the transitive closure and nothing else', (): void => {
      const reachable = reachableSchemas(root, schemas);

      expect(Object.keys(reachable).sort()).toStrictEqual(['address', 'customer']);
    });
  });

  describe('GIVEN a schema on a reference cycle', (): void => {
    it('WHEN collecting THEN terminates and includes the cycle once', (): void => {
      const reachable = reachableSchemas(node, schemas);

      expect(Object.keys(reachable)).toStrictEqual(['node']);
    });
  });

  describe('GIVEN a reference hidden under a vendor extension', (): void => {
    it('WHEN collecting THEN skips the x- key', (): void => {
      expect(reachableSchemas(extended, schemas)).toStrictEqual({});
    });
  });

  describe('GIVEN a reference to a component the spec lacks', (): void => {
    it('WHEN collecting THEN names the unresolved reference', (): void => {
      expect((): unknown => reachableSchemas(ghost, schemas)).toThrow('unresolved schema reference "#/components/schemas/ghost"');
    });

    it('WHEN collecting THEN the error is a FixtureError whose fix names the component to add', (): void => {
      const expected = {
        name: 'FixtureError',
        fix: 'add components.schemas["ghost"] to the spec, or point the $ref at an existing schema'
      };

      expect((): unknown => reachableSchemas(ghost, schemas)).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN a pointer into a component and an anchor a component declares', (): void => {
    it('WHEN collecting THEN each reaches the whole component it lands in', (): void => {
      const properties = { country: COUNTRY_REF, home: ANCHOR_REF };
      const schema: JSONSchema7 = { type: 'object', properties };

      const reachable = reachableSchemas(schema, schemas);

      expect(reachable).toStrictEqual({ address, home });
    });
  });

  describe('GIVEN an anchor no component declares', (): void => {
    it('WHEN collecting THEN it is skipped for the validator to resolve', (): void => {
      const reachable = reachableSchemas(LOOSE_REF, schemas);

      expect(reachable).toStrictEqual({});
    });
  });
});
