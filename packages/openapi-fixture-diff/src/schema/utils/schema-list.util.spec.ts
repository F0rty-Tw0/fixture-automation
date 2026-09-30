import { describe, expect, it } from 'vitest';

import { isItemList } from './schema-list.util.ts';
import type { SpecSchema, SpecSchemas } from '../common/schema.type.ts';

const ITEM: SpecSchema = { type: 'object' };
const ITEM_REF: SpecSchema = { $ref: '#/components/schemas/item' };
const ITEMS: SpecSchema = { type: 'array', items: ITEM_REF };
const UNTYPED_ITEMS: SpecSchema = { items: ITEM_REF };
const NULLABLE_ITEMS: SpecSchema = { type: ['array', 'null'] };
const ITEMS_REF: SpecSchema = { $ref: '#/components/schemas/items' };
const NULL_ONLY: SpecSchema = { type: 'null' };
const NULLABLE_LIST: SpecSchema = { anyOf: [ITEMS_REF, NULL_ONLY] };
const LIST_OR_PAGE: SpecSchema = { oneOf: [ITEMS, ITEM] };
const SCHEMAS: SpecSchemas = { item: ITEM, items: ITEMS };

describe('FEATURE: list payload detection', (): void => {
  describe('GIVEN an array payload', (): void => {
    it('WHEN held against an object schema THEN it is a list of that schema', (): void => {
      const isList = isItemList(ITEM_REF, SCHEMAS, [{}]);

      expect(isList).toBe(true);
    });

    it('WHEN held against a referenced array schema THEN it is not', (): void => {
      const isList = isItemList(ITEMS_REF, SCHEMAS, [{}]);

      expect(isList).toBe(false);
    });

    it('WHEN held against a schema with items but no type THEN it is not', (): void => {
      const isList = isItemList(UNTYPED_ITEMS, SCHEMAS, [{}]);

      expect(isList).toBe(false);
    });

    it('WHEN held against an anyOf with a referenced array member THEN it is not', (): void => {
      const isList = isItemList(NULLABLE_LIST, SCHEMAS, [{}]);

      expect(isList).toBe(false);
    });

    it('WHEN held against a oneOf with an array member THEN it is not', (): void => {
      const isList = isItemList(LIST_OR_PAGE, SCHEMAS, [{}]);

      expect(isList).toBe(false);
    });

    it('WHEN held against a type list naming array THEN it is not', (): void => {
      const isList = isItemList(NULLABLE_ITEMS, SCHEMAS, []);

      expect(isList).toBe(false);
    });
  });

  describe('GIVEN an object payload', (): void => {
    it('WHEN held against an object schema THEN it is not a list', (): void => {
      const isList = isItemList(ITEM_REF, SCHEMAS, {});

      expect(isList).toBe(false);
    });
  });
});
