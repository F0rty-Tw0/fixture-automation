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
const extended: JSONSchema7 = { type: 'object', 'x-example': CUSTOMER_REF } as JSONSchema7;
const ghost: JSONSchema7 = { $ref: '#/components/schemas/ghost' };
const schemas = { customer, address, node, unrelated: TEXT };

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
      expect((): unknown => reachableSchemas(ghost, schemas)).toThrow('unresolved schema reference "ghost"');
    });
  });
});
