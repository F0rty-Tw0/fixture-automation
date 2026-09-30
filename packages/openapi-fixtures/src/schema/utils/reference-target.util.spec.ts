import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';

import { referenceTarget } from './reference-target.util.ts';

const TAG: JSONSchema7 = { type: 'string' };
const PET_PROPERTIES = { tag: TAG };
const PET: JSONSchema7 = { type: 'object', properties: PET_PROPERTIES };
const ANCHOR_FIELDS = { $anchor: 'pet', type: 'object' } as const;
const ANCHORED: JSONSchema7 = ANCHOR_FIELDS;
const SLASHED: JSONSchema7 = { type: 'integer' };
const TRUE_PROPERTIES = { any: true };
const OPEN: JSONSchema7 = { type: 'object', properties: TRUE_PROPERTIES };
const SCHEMAS: Record<string, JSONSchema7> = { Pet: PET, Anchored: ANCHORED, 'a/b': SLASHED, Open: OPEN };
const BOOLEAN_FIRST: Record<string, unknown> = { Any: true, Anchored: ANCHORED };

describe('FEATURE: $ref target lookup', (): void => {
  describe('GIVEN a pointer to a declared component', (): void => {
    it('WHEN looked up THEN selects the component itself', (): void => {
      const target = referenceTarget('#/components/schemas/Pet', SCHEMAS);

      expect(target).toStrictEqual({ component: 'Pet', componentSchema: PET, schema: PET });
    });

    it('WHEN the name holds an escaped slash THEN selects the component with that name', (): void => {
      const target = referenceTarget('#/components/schemas/a~1b', SCHEMAS);

      expect(target?.schema).toBe(SLASHED);
    });

    it('WHEN the pointer goes deeper THEN selects the schema inside the component', (): void => {
      const target = referenceTarget('#/components/schemas/Pet/properties/tag', SCHEMAS);

      expect(target).toStrictEqual({ component: 'Pet', componentSchema: PET, schema: TAG });
    });

    it('WHEN the deeper pointer lands on a boolean schema THEN leaves it to the validator', (): void => {
      const target = referenceTarget('#/components/schemas/Open/properties/any', SCHEMAS);

      expect(target).toBeUndefined();
    });
  });

  describe('GIVEN a pointer that selects nothing', (): void => {
    it('WHEN the component is undeclared THEN fails with the fix naming it', (): void => {
      const expected = {
        message: 'unresolved schema reference "#/components/schemas/ghost"',
        fix: 'add components.schemas["ghost"] to the spec, or point the $ref at an existing schema'
      };

      expect((): unknown => referenceTarget('#/components/schemas/ghost', SCHEMAS)).toThrow(expect.objectContaining(expected));
    });

    it('WHEN the name is an Object prototype member THEN fails with the fix naming it', (): void => {
      const expected = { fix: 'add components.schemas["constructor"] to the spec, or point the $ref at an existing schema' };

      expect((): unknown => referenceTarget('#/components/schemas/constructor', SCHEMAS)).toThrow(expect.objectContaining(expected));
    });

    it('WHEN the path inside a declared component is absent THEN fails with a fix naming the component', (): void => {
      const expected = { fix: 'point the $ref at a schema that exists inside components.schemas["Pet"]' };

      expect((): unknown => referenceTarget('#/components/schemas/Pet/properties/name', SCHEMAS)).toThrow(
        expect.objectContaining(expected)
      );
    });

    it('WHEN the percent escape is malformed THEN fails with the escape fix', (): void => {
      const expected = { fix: 'fix the percent escape in the $ref' };

      expect((): unknown => referenceTarget('#/components/schemas/%E0%A4%A', SCHEMAS)).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN an anchor reference', (): void => {
    it('WHEN a component declares the anchor THEN selects that component', (): void => {
      const target = referenceTarget('#pet', SCHEMAS);

      expect(target).toStrictEqual({ component: 'Anchored', componentSchema: ANCHORED, schema: ANCHORED });
    });

    it('WHEN a boolean component precedes the one declaring it THEN still selects that component', (): void => {
      const target = referenceTarget('#pet', BOOLEAN_FIRST);

      expect(target?.component).toBe('Anchored');
    });

    it('WHEN only a boolean component precedes an unknown anchor THEN leaves it to the validator', (): void => {
      const target = referenceTarget('#nowhere', BOOLEAN_FIRST);

      expect(target).toBeUndefined();
    });

    it('WHEN no component declares it THEN leaves it to the validator', (): void => {
      const target = referenceTarget('#nowhere', SCHEMAS);

      expect(target).toBeUndefined();
    });
  });

  describe('GIVEN a pointer outside components.schemas', (): void => {
    it('WHEN looked up THEN leaves it to the validator', (): void => {
      const target = referenceTarget('#/$defs/pet', SCHEMAS);

      expect(target).toBeUndefined();
    });

    it('WHEN the reference is to another document THEN leaves it to the validator', (): void => {
      const target = referenceTarget('other.json#pet', SCHEMAS);

      expect(target).toBeUndefined();
    });
  });
});
