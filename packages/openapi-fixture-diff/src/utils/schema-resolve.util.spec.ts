import { describe, expect, it } from 'vitest';

import { firstBranch, pickBranch, referencedNames, resolveSchema } from './schema-resolve.util.ts';
import type { SpecSchema, SpecSchemas } from '../common/schema.type.ts';

const TEXT: SpecSchema = { type: 'string' };
const COUNT: SpecSchema = { type: 'integer' };
const PARTY_REF: SpecSchema = { $ref: '#/components/schemas/party' };
const CUSTOMER_REF: SpecSchema = { $ref: '#/components/schemas/customer' };
const SUPPLIER_REF: SpecSchema = { $ref: '#/components/schemas/supplier' };
const GHOST_REF: SpecSchema = { $ref: '#/components/schemas/ghost' };
const FOREIGN_REF: SpecSchema = { $ref: '#/definitions/party' };
const PARTY_PROPERTIES = { name: TEXT, country: TEXT };
const PARTY: SpecSchema = { type: 'object', required: ['name'], properties: PARTY_PROPERTIES };
const CUSTOMER_PROPERTIES = { email: TEXT, name: COUNT };
const CUSTOMER_EXTRA: SpecSchema = { type: 'object', required: ['email', 'name'], properties: CUSTOMER_PROPERTIES };
const CUSTOMER: SpecSchema = { description: 'buyer', allOf: [PARTY_REF, true, CUSTOMER_EXTRA] };
const SUPPLIER_PROPERTIES = { supplierId: TEXT, region: TEXT };
const SUPPLIER: SpecSchema = { type: 'object', required: ['supplierId'], properties: SUPPLIER_PROPERTIES };
const LOOP_A: SpecSchema = { $ref: '#/components/schemas/loopB' };
const LOOP_B: SpecSchema = { $ref: '#/components/schemas/loopA' };
const SCHEMAS: SpecSchemas = {
  party: PARTY,
  customer: CUSTOMER,
  supplier: SUPPLIER,
  alias: CUSTOMER_REF,
  loopA: LOOP_A,
  loopB: LOOP_B
};
const MERGED_PROPERTIES = { name: COUNT, country: TEXT, email: TEXT };
const MERGED_CUSTOMER: SpecSchema = {
  description: 'buyer',
  type: 'object',
  properties: MERGED_PROPERTIES,
  required: ['name', 'email']
};
const OBJECT_ONLY: SpecSchema = { type: 'object' };
const PLAIN_ONLY: SpecSchema = { description: 'plain' };
const KEYWORD_ONLY: SpecSchema = { allOf: [OBJECT_ONLY, PLAIN_ONLY] };
const SOURCE: SpecSchema = { anyOf: [TEXT, SUPPLIER_REF], description: 'origin' };
const CHOICE: SpecSchema = { oneOf: [PARTY_REF, SUPPLIER_REF] };
const EMPTY_ANY: SpecSchema = { anyOf: [], oneOf: [TEXT, COUNT] };
const REGIONAL = { region: 'eu' };

describe('FEATURE: schema reference and composition resolution', (): void => {
  describe('GIVEN a schema without references or allOf', (): void => {
    it('WHEN resolving THEN the same schema is returned', (): void => {
      const resolved = resolveSchema(PARTY, SCHEMAS);

      expect(resolved).toBe(PARTY);
    });
  });

  describe('GIVEN a reference chain ending in an allOf', (): void => {
    it('WHEN resolving THEN every member is flattened and the later member wins overlapping keys', (): void => {
      const resolved = resolveSchema(CUSTOMER_REF, SCHEMAS);

      expect(resolved).toStrictEqual(MERGED_CUSTOMER);
    });
  });

  describe('GIVEN an allOf whose members carry neither properties nor required', (): void => {
    it('WHEN resolving THEN the merged schema carries only the keywords', (): void => {
      const expected = { type: 'object', description: 'plain' };

      const resolved = resolveSchema(KEYWORD_ONLY, SCHEMAS);

      expect(resolved).toStrictEqual(expected);
    });
  });

  describe('GIVEN two references pointing at each other', (): void => {
    it('WHEN resolving THEN it fails naming the repeated reference', (): void => {
      expect((): unknown => resolveSchema(LOOP_A, SCHEMAS)).toThrow('circular schema reference "#/components/schemas/loopB"');
    });
  });

  describe('GIVEN a reference to an unknown component', (): void => {
    it('WHEN resolving THEN it fails naming the reference', (): void => {
      expect((): unknown => resolveSchema(GHOST_REF, SCHEMAS)).toThrow('unresolved schema reference "#/components/schemas/ghost"');
    });

    it('WHEN collecting referenced names THEN the name is listed without expansion', (): void => {
      const names = referencedNames(GHOST_REF, SCHEMAS);

      expect(names).toStrictEqual(['ghost']);
    });
  });

  describe('GIVEN a reference chain through an allOf', (): void => {
    it('WHEN collecting referenced names THEN every name is listed once in visiting order', (): void => {
      const names = referencedNames(CUSTOMER_REF, SCHEMAS);

      expect(names).toStrictEqual(['customer', 'party']);
    });
  });

  describe('GIVEN anyOf and oneOf members naming the same component', (): void => {
    it('WHEN collecting referenced names THEN the repeated name and the boolean member are skipped', (): void => {
      const schema: SpecSchema = { anyOf: [SUPPLIER_REF, true], oneOf: [SUPPLIER_REF, PARTY_REF] };

      const names = referencedNames(schema, SCHEMAS);

      expect(names).toStrictEqual(['supplier', 'party']);
    });
  });

  describe('GIVEN a reference outside components.schemas', (): void => {
    it('WHEN collecting referenced names THEN nothing is listed', (): void => {
      const names = referencedNames(FOREIGN_REF, SCHEMAS);

      expect(names).toStrictEqual([]);
    });
  });

  describe('GIVEN a schema without references', (): void => {
    it('WHEN collecting referenced names THEN nothing is listed', (): void => {
      const names = referencedNames(PARTY, SCHEMAS);

      expect(names).toStrictEqual([]);
    });
  });

  describe('GIVEN an anyOf with two members', (): void => {
    it('WHEN collapsing to the first branch THEN only the first member stays and other keywords are kept', (): void => {
      const expected = { anyOf: [TEXT], description: 'origin' };

      const collapsed = firstBranch(SOURCE);

      expect(collapsed).toStrictEqual(expected);
    });
  });

  describe('GIVEN a oneOf with two members', (): void => {
    it('WHEN collapsing to the first branch THEN only the first member stays', (): void => {
      const collapsed = firstBranch(CHOICE);

      expect(collapsed).toStrictEqual({ oneOf: [PARTY_REF] });
    });
  });

  describe('GIVEN an empty anyOf beside a oneOf', (): void => {
    it('WHEN collapsing to the first branch THEN the oneOf is collapsed', (): void => {
      const expected = { anyOf: [], oneOf: [TEXT] };

      const collapsed = firstBranch(EMPTY_ANY);

      expect(collapsed).toStrictEqual(expected);
    });
  });

  describe('GIVEN a schema without anyOf or oneOf', (): void => {
    it('WHEN collapsing to the first branch THEN the same schema is returned', (): void => {
      const collapsed = firstBranch(PARTY);

      expect(collapsed).toBe(PARTY);
    });

    it('WHEN picking a branch THEN nothing is picked', (): void => {
      const branch = pickBranch(PARTY, REGIONAL, SCHEMAS);

      expect(branch).toBeUndefined();
    });
  });

  describe('GIVEN an anyOf mixing a scalar and a referenced object', (): void => {
    it('WHEN picking a branch for an object value THEN the resolved object member is picked', (): void => {
      const branch = pickBranch(SOURCE, REGIONAL, SCHEMAS);

      expect(branch).toStrictEqual(SUPPLIER);
    });

    it('WHEN picking a branch for a string value THEN nothing is picked', (): void => {
      const branch = pickBranch(SOURCE, 'internal', SCHEMAS);

      expect(branch).toBeUndefined();
    });
  });

  describe('GIVEN a oneOf whose second member explains more keys', (): void => {
    it('WHEN picking a branch THEN the best scoring member wins', (): void => {
      const branch = pickBranch(CHOICE, REGIONAL, SCHEMAS);

      expect(branch).toStrictEqual(SUPPLIER);
    });

    it('WHEN no member explains any key THEN the first object member is picked', (): void => {
      const branch = pickBranch(CHOICE, {}, SCHEMAS);

      expect(branch).toStrictEqual(PARTY);
    });
  });

  describe('GIVEN a oneOf of scalars and a boolean member', (): void => {
    it('WHEN picking a branch THEN nothing is picked', (): void => {
      const schema: SpecSchema = { oneOf: [TEXT, true] };

      const branch = pickBranch(schema, REGIONAL, SCHEMAS);

      expect(branch).toBeUndefined();
    });
  });
});
