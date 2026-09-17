import { describe, expect, it } from 'vitest';

import { schemaChildren } from './schema-children.util.ts';

const STRING = { type: 'string' };
const NUMBER = { type: 'number' };
const BOOLEAN = { type: 'boolean' };

const children = (schema: Record<string, unknown>): unknown[] => Array.from(schemaChildren(schema));

describe('FEATURE: schema child traversal', (): void => {
  describe('GIVEN an empty schema', (): void => {
    it('WHEN listing children THEN yields nothing', (): void => {
      expect(children({})).toStrictEqual([]);
    });
  });

  describe('GIVEN singular subschema keywords', (): void => {
    it('WHEN listing children THEN yields each defined one in keyword order', (): void => {
      const schema = { then: NUMBER, if: STRING, not: BOOLEAN };

      expect(children(schema)).toStrictEqual([STRING, BOOLEAN, NUMBER]);
    });

    it('WHEN additionalProperties is a boolean THEN skips it', (): void => {
      expect(children({ additionalProperties: false })).toStrictEqual([]);
    });

    it('WHEN additionalProperties is a schema THEN yields it', (): void => {
      expect(children({ additionalProperties: STRING })).toStrictEqual([STRING]);
    });
  });

  describe('GIVEN an items keyword', (): void => {
    it('WHEN items is a tuple THEN yields each entry', (): void => {
      expect(children({ items: [STRING, NUMBER] })).toStrictEqual([STRING, NUMBER]);
    });

    it('WHEN items is one schema THEN yields it', (): void => {
      expect(children({ items: STRING })).toStrictEqual([STRING]);
    });

    it('WHEN items is a boolean THEN yields it', (): void => {
      expect(children({ items: false })).toStrictEqual([false]);
    });
  });

  describe('GIVEN applicator arrays', (): void => {
    it('WHEN the keyword holds a list THEN yields each entry', (): void => {
      const schema = { allOf: [STRING], prefixItems: [NUMBER, BOOLEAN] };

      expect(children(schema)).toStrictEqual([STRING, NUMBER, BOOLEAN]);
    });

    it('WHEN the keyword is not a list THEN skips it', (): void => {
      expect(children({ anyOf: STRING })).toStrictEqual([]);
    });
  });

  describe('GIVEN keyword maps', (): void => {
    it('WHEN the keyword holds an object THEN yields its values', (): void => {
      const properties = { id: STRING, amount: NUMBER };
      const $defs = { flag: BOOLEAN };

      expect(children({ properties, $defs })).toStrictEqual([BOOLEAN, STRING, NUMBER]);
    });

    it('WHEN the keyword is not an object THEN skips it', (): void => {
      expect(children({ properties: [STRING] })).toStrictEqual([]);
    });
  });

  describe('GIVEN draft-07 dependencies', (): void => {
    it('WHEN a dependency is a schema THEN yields it', (): void => {
      const dependencies = { id: STRING };

      expect(children({ dependencies })).toStrictEqual([STRING]);
    });

    it('WHEN a dependency is a property list THEN skips it', (): void => {
      const dependencies = { id: ['name'] };

      expect(children({ dependencies })).toStrictEqual([]);
    });

    it('WHEN dependencies is not an object THEN skips it', (): void => {
      expect(children({ dependencies: 'id' })).toStrictEqual([]);
    });
  });

  describe('GIVEN every keyword group at once', (): void => {
    it('WHEN listing children THEN orders singular, items, arrays, maps, then dependencies', (): void => {
      const dependencies = { id: BOOLEAN };
      const properties = { name: NUMBER };
      const schema = { dependencies, properties, oneOf: [STRING], items: BOOLEAN, not: NUMBER };

      expect(children(schema)).toStrictEqual([NUMBER, BOOLEAN, STRING, NUMBER, BOOLEAN]);
    });
  });
});
