import { describe, expect, it } from 'vitest';

import { compiledSchema, payloadCheck } from './payload-check.util.ts';
import type { SpecSchema } from '../../schema/common/schema.type.ts';
import { nestedOrder, nestedSpec, schemaSpec } from '../../test/utils/nested-spec.spec.util.ts';

const ORDER_REF: SpecSchema = { $ref: '#/components/schemas/order' };
const ORDER_LIST: SpecSchema = { type: 'array', items: ORDER_REF };
const CYCLE_A_REF: SpecSchema = { $ref: '#/components/schemas/cycleA' };
const CYCLE_B_REF: SpecSchema = { $ref: '#/components/schemas/cycleB' };
const GHOST_REF: SpecSchema = { $ref: '#/components/schemas/ghost' };
const ID: SpecSchema = { type: 'integer' };
const SELFISH_REF: SpecSchema = { $ref: '#/components/schemas/selfish' };
const CIRCULAR_MESSAGE =
  'circular schema reference: a schema reaches itself through anyOf/oneOf/allOf or $ref before reaching any value';
const CIRCULAR_FIX = 'break the cycle in the spec: an anyOf/oneOf/allOf member must not refer back to its own schema directly';
const ID_PROPERTIES = { id: ID };
const ITEM: SpecSchema = { type: 'object', required: ['id'], properties: ID_PROPERTIES };
const ITEM_REF: SpecSchema = { $ref: '#/components/schemas/item' };
const ITEM_ARRAY: SpecSchema = { type: 'array', items: ITEM_REF };
const NULL_ONLY: SpecSchema = { type: 'null' };
const NULLABLE_ITEMS: SpecSchema = { anyOf: [ITEM_ARRAY, NULL_ONLY] };
const UNTYPED_ITEM: SpecSchema = { properties: ID_PROPERTIES };
const LIST_SCHEMAS = { item: ITEM, items: NULLABLE_ITEMS, untyped: UNTYPED_ITEM };
const LIST_SPEC = schemaSpec(LIST_SCHEMAS, '3.1.0');
const ITEMS_REF: SpecSchema = { $ref: '#/components/schemas/items' };
const UNTYPED_REF: SpecSchema = { $ref: '#/components/schemas/untyped' };

describe('FEATURE: payload validation for the diff walk', (): void => {
  describe('GIVEN a schema a JSON Schema validator cannot compile', (): void => {
    it('WHEN compiled THEN it fails with a FixtureError naming the schema and a fix', async (): Promise<void> => {
      const source = await nestedSpec();
      const code: SpecSchema = { type: 'string', pattern: '(' };
      const properties = { code };
      const coded: SpecSchema = { type: 'object', properties };
      const schemas = { coded };
      const components = { schemas };
      const spec = { ...source, components };
      const expected = { name: 'FixtureError', fix: 'fix schema "coded" in the spec so a JSON Schema validator accepts it' };

      expect((): unknown => compiledSchema(spec, 'coded')).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN a schema name the spec does not declare', (): void => {
    it("WHEN compiled THEN the validator's own FixtureError and suggestion pass through unwrapped", (): void => {
      const spec = schemaSpec(LIST_SCHEMAS);
      const expected = { message: 'schema "itemz" is unavailable', fix: 'available: item, items, untyped' };

      expect((): unknown => compiledSchema(spec, 'itemz')).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN components that include each other through allOf', (): void => {
    it('WHEN compiled THEN it fails with the cycle fix instead of overflowing the validator', (): void => {
      const cycleA: SpecSchema = { allOf: [CYCLE_B_REF] };
      const cycleB: SpecSchema = { allOf: [CYCLE_A_REF] };
      const spec = schemaSpec({ cycleA, cycleB });
      const expected = { name: 'FixtureError', fix: 'break the $ref/allOf cycle through "#/components/schemas/cycleB" in the spec' };

      expect((): unknown => compiledSchema(spec, 'cycleA')).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN a property referencing an undeclared component', (): void => {
    it('WHEN compiled THEN the fix names the component to add', (): void => {
      const properties = { ghost: GHOST_REF };
      const haunted: SpecSchema = { type: 'object', properties };
      const spec = schemaSpec({ haunted });
      const expected = {
        name: 'FixtureError',
        fix: 'add components.schemas["ghost"] to the spec, or point the $ref at an existing schema'
      };

      expect((): unknown => compiledSchema(spec, 'haunted')).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN a oneOf whose member refers straight back to its own schema', (): void => {
    it('WHEN checked THEN the validator overflow becomes the circular-reference FixtureError with its fix', (): void => {
      const selfish: SpecSchema = { oneOf: [SELFISH_REF, ID] };
      const spec = schemaSpec({ selfish });
      const prepared = compiledSchema(spec, 'selfish');
      const expected = { name: 'FixtureError', message: CIRCULAR_MESSAGE, fix: CIRCULAR_FIX };

      expect((): unknown => payloadCheck(prepared, SELFISH_REF, { selfish }, {})).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN an object payload', (): void => {
    it('WHEN checked THEN the walk keeps the source schema and AJV reports paths from the payload root', async (): Promise<void> => {
      const spec = await nestedSpec();
      const order = await nestedOrder();
      const payload = { ...order, created: 'yesterday' };
      const prepared = compiledSchema(spec, 'order');
      const schemas = spec.components?.schemas ?? {};
      const violation = { instancePath: '/created', keyword: 'type' };

      const checked = payloadCheck(prepared, ORDER_REF, schemas, payload);

      expect(checked.schema).toBe(ORDER_REF);
      expect(checked.violations).toMatchObject([violation]);
    });
  });

  describe('GIVEN a list payload valid against an anyOf with an array member', (): void => {
    it('WHEN checked THEN the walk keeps the source schema and nothing is violated', (): void => {
      const prepared = compiledSchema(LIST_SPEC, 'items');
      const payload = [{ id: 1 }, { id: 2 }];

      const checked = payloadCheck(prepared, ITEMS_REF, LIST_SCHEMAS, payload);

      expect(checked).toStrictEqual({ schema: ITEMS_REF, violations: [] });
    });
  });

  describe('GIVEN a list payload held against an untyped item schema that accepts any array', (): void => {
    it('WHEN checked THEN each element is still validated as an item', (): void => {
      const prepared = compiledSchema(LIST_SPEC, 'untyped');
      const payload = [{ id: 'one' }];
      const schema: SpecSchema = { type: 'array', items: UNTYPED_REF };
      const violation = { instancePath: '/0/id', keyword: 'type' };

      const checked = payloadCheck(prepared, UNTYPED_REF, LIST_SCHEMAS, payload);

      expect(checked.schema).toStrictEqual(schema);
      expect(checked.violations).toMatchObject([violation]);
    });
  });

  describe('GIVEN a list payload held against its item schema', (): void => {
    it('WHEN checked THEN the walk gets an array of the item schema and violations carry the element index', async (): Promise<void> => {
      const spec = await nestedSpec();
      const order = await nestedOrder();
      const stale = { ...order, created: 'yesterday' };
      const prepared = compiledSchema(spec, 'order');
      const schemas = spec.components?.schemas ?? {};
      const payload = [order, stale];
      const violation = { instancePath: '/1/created', keyword: 'type' };

      const checked = payloadCheck(prepared, ORDER_REF, schemas, payload);

      expect(checked.schema).toStrictEqual(ORDER_LIST);
      expect(checked.violations).toMatchObject([violation]);
    });
  });
});
