import type { SpecSchema } from '@fixture-automation/openapi-fixture-diff';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { validationErrors } from './fixture-validation.util.ts';
import { studioSpec } from '../../test/utils/studio-spec.spec.util.ts';
import { schemasSpec } from '../test/utils/list-spec.spec.util.ts';

const ID: SpecSchema = { type: 'integer' };
const ID_PROPERTIES = { id: ID };
const ITEM: SpecSchema = { type: 'object', required: ['id'], properties: ID_PROPERTIES };
const ITEM_REF: SpecSchema = { $ref: '#/components/schemas/item' };
const ITEM_ARRAY: SpecSchema = { type: 'array', items: ITEM_REF };
const NULL_ONLY: SpecSchema = { type: 'null' };
const LOOSE_ITEM: SpecSchema = { required: ['id'], properties: ID_PROPERTIES };
const SELFISH_REF: SpecSchema = { $ref: '#/components/schemas/selfish' };
const SELFISH: SpecSchema = { oneOf: [SELFISH_REF, ID] };
const NULLABLE_ITEMS: SpecSchema = { anyOf: [ITEM_ARRAY, NULL_ONLY] };
const CYCLE_A_REF: SpecSchema = { $ref: '#/components/schemas/cycleA' };
const CYCLE_B_REF: SpecSchema = { $ref: '#/components/schemas/cycleB' };
const GHOST_REF: SpecSchema = { $ref: '#/components/schemas/ghost' };
const BAD_CODE: SpecSchema = { type: 'string', pattern: '(' };
const BAD_PROPERTIES = { code: BAD_CODE };
const GHOST_PROPERTIES = { ghost: GHOST_REF };
const CYCLE_A: SpecSchema = { allOf: [CYCLE_B_REF] };
const CYCLE_B: SpecSchema = { allOf: [CYCLE_A_REF] };
const HAUNTED: SpecSchema = { type: 'object', properties: GHOST_PROPERTIES };
const BAD: SpecSchema = { type: 'object', properties: BAD_PROPERTIES };
const CYCLE_SCHEMAS = { cycleA: CYCLE_A, cycleB: CYCLE_B };
const GHOST_SCHEMAS = { cycleA: HAUNTED };
const BAD_SCHEMAS = { cycleA: BAD };

describe('FEATURE: fixture validation', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN the invoice schema', (): void => {
    it('WHEN the value conforms THEN lists no errors', (): void => {
      const invoice = { id: 'in_1', amount_due: 1, status: 'open' };

      const errors = validationErrors(spec, 'invoice', invoice);

      expect(errors).toStrictEqual([]);
    });

    it('WHEN a nested value violates it THEN lists path: message', (): void => {
      const invoice = { id: 'in_1', amount_due: 1, status: 'closed' };

      const errors = validationErrors(spec, 'invoice', invoice);

      expect(errors).toStrictEqual(['/status: must be equal to one of the allowed values']);
    });

    it('WHEN the root violates it THEN the path is /', (): void => {
      const errors = validationErrors(spec, 'invoice', 'nope');

      expect(errors).toStrictEqual(['/: must be object']);
    });
  });

  describe('GIVEN a list held against the invoice schema', (): void => {
    it('WHEN every element conforms THEN lists no errors', (): void => {
      const invoice = { id: 'in_1', amount_due: 1, status: 'open' };

      const errors = validationErrors(spec, 'invoice', [invoice, invoice]);

      expect(errors).toStrictEqual([]);
    });

    it('WHEN elements violate it THEN each path starts at the element index', (): void => {
      const invoice = { id: 'in_1', amount_due: 1, status: 'closed' };

      const errors = validationErrors(spec, 'invoice', [invoice, 'nope']);

      expect(errors).toStrictEqual(['/0/status: must be equal to one of the allowed values', '/1: must be object']);
    });
  });

  describe('GIVEN a list valid against an anyOf with an array member', (): void => {
    it('WHEN validated THEN lists no errors', (): void => {
      const items = schemasSpec({ item: ITEM, items: NULLABLE_ITEMS }, '3.1.0');
      const value = [{ id: 1 }, { id: 2 }];

      const errors = validationErrors(items, 'items', value);

      expect(errors).toStrictEqual([]);
    });
  });

  describe('GIVEN a list held against an untyped item schema that accepts any array', (): void => {
    it('WHEN elements violate the item schema THEN each is reported by index', (): void => {
      const loose = schemasSpec({ loose: LOOSE_ITEM });
      const value = [{ id: 'x' }, {}];

      const errors = validationErrors(loose, 'loose', value);

      expect(errors).toStrictEqual(['/0/id: must be integer', "/1: must have required property 'id'"]);
    });
  });

  describe('GIVEN a oneOf whose member refers straight back to its own schema', (): void => {
    it('WHEN validated THEN the validator overflow becomes the circular-reference FixtureError with its fix', (): void => {
      const selfish = schemasSpec({ selfish: SELFISH });
      const fix = 'break the cycle in the spec: an anyOf/oneOf/allOf member must not refer back to its own schema directly';

      expect((): unknown => validationErrors(selfish, 'selfish', {})).toThrow(expect.objectContaining({ name: 'FixtureError', fix }));
    });
  });

  describe('GIVEN a spec problem the validator cannot compile or would overflow on', (): void => {
    it.each<[string, Record<string, SpecSchema>, string]>([
      ['an allOf cycle', CYCLE_SCHEMAS, 'break the $ref/allOf cycle through "#/components/schemas/cycleB" in the spec'],
      [
        'an undeclared component',
        GHOST_SCHEMAS,
        'add components.schemas["ghost"] to the spec, or point the $ref at an existing schema'
      ],
      ['a bad pattern', BAD_SCHEMAS, 'fix schema "cycleA" in the spec so a JSON Schema validator accepts it']
    ])(
      'WHEN validating against %s THEN it fails with a FixtureError and its fix',
      (_label: string, schemas: Record<string, SpecSchema>, fix: string): void => {
        const broken = schemasSpec(schemas);

        expect((): unknown => validationErrors(broken, 'cycleA', {})).toThrow(expect.objectContaining({ name: 'FixtureError', fix }));
      }
    );
  });
});
