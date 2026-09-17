import { describe, expect, it } from 'vitest';

import { askSchemaName, resolveSchemaName, schemaTarget } from './schema-name.util.ts';
import { silentInputs } from './silent-inputs.util.ts';
import { FIXTURES_INPUTS } from '../common/fixtures-cli.const.ts';
import type { OpenApiSpec, SchemaTarget } from '../common/openapi.type.ts';
import { inputsMock } from '../test/mocks/inputs.mock.ts';

const INVOICE = { type: 'object' } as const;
const SCHEMAS = { invoice: INVOICE };
const COMPONENTS = { schemas: SCHEMAS };
const NAME_FIX = 'pass <schema-name>, or use a spec written by openapi-types <spec-url> <schema-name> <out-file>';

const plain: OpenApiSpec = { components: COMPONENTS };
const pruned: OpenApiSpec = { 'x-root-schema': 'invoice', components: COMPONENTS };
const blankRoot: OpenApiSpec = { 'x-root-schema': '', components: COMPONENTS };
const SCHEMA_INPUT = FIXTURES_INPUTS.schemaName;

describe('FEATURE: schema name defaulting', (): void => {
  describe('GIVEN an explicit name', (): void => {
    it('WHEN resolving THEN returns it untouched, even against a pruned spec', (): void => {
      expect(resolveSchemaName(pruned, 'refund')).toBe('refund');
    });
  });

  describe('GIVEN no name and a pruned spec', (): void => {
    it('WHEN resolving THEN falls back to x-root-schema', (): void => {
      expect(resolveSchemaName(pruned, undefined)).toBe('invoice');
    });
  });

  describe('GIVEN no name and a spec without a root', (): void => {
    it('WHEN resolving THEN asks for the name and points at openapi-types', (): void => {
      const failure = (): unknown => resolveSchemaName(plain, '');

      expect(failure).toThrow('schema name required');
      expect(failure).toThrow(expect.objectContaining({ fix: NAME_FIX }));
    });
  });

  describe('GIVEN a prompt session and a pruned spec', (): void => {
    describe('WHEN asking for the schema name', (): void => {
      it('THEN nothing is asked and the name is left to the root', async (): Promise<void> => {
        const inputs = inputsMock('invoic');

        const name = await askSchemaName(pruned, undefined, SCHEMA_INPUT, inputs);

        expect(name).toBeUndefined();
        expect(inputs.optional).not.toHaveBeenCalled();
      });

      it('THEN a given name still wins over the root', async (): Promise<void> => {
        const name = await askSchemaName(pruned, 'refund', SCHEMA_INPUT, inputsMock('invoic'));

        expect(name).toBe('refund');
      });
    });
  });

  describe('GIVEN a prompt session and a spec without a root', (): void => {
    it('WHEN asking for the schema name THEN the typed answer is the name', async (): Promise<void> => {
      const inputs = inputsMock('invoice');

      const name = await askSchemaName(plain, undefined, SCHEMA_INPUT, inputs);

      expect(name).toBe('invoice');
      expect(inputs.optional).toHaveBeenCalledWith(undefined, SCHEMA_INPUT);
    });
  });

  describe('GIVEN a prompt session and a blank x-root-schema', (): void => {
    it('WHEN asking for the schema name THEN it is asked like a spec without a root', async (): Promise<void> => {
      const name = await askSchemaName(blankRoot, undefined, SCHEMA_INPUT, inputsMock('invoice'));

      expect(name).toBe('invoice');
    });
  });

  describe('GIVEN a silent run and a spec without a root', (): void => {
    it('WHEN asking for the schema name THEN the given value comes back unasked', async (): Promise<void> => {
      const name = await askSchemaName(plain, undefined, SCHEMA_INPUT, silentInputs);

      expect(name).toBeUndefined();
    });
  });
});

describe('FEATURE: schema and out-file positionals', (): void => {
  describe('GIVEN two values', (): void => {
    it('WHEN splitting THEN the first is the name and the second the out-file', (): void => {
      const expected: SchemaTarget = { schemaName: 'refund', outFile: 'out.json' };

      expect(schemaTarget(pruned, 'refund', 'out.json')).toStrictEqual(expected);
    });
  });

  describe('GIVEN one value the spec declares', (): void => {
    it('WHEN splitting THEN it is the schema name and output goes to stdout', (): void => {
      const expected: SchemaTarget = { schemaName: 'invoice', outFile: undefined };

      expect(schemaTarget(plain, 'invoice', undefined)).toStrictEqual(expected);
    });
  });

  describe('GIVEN one value a pruned spec does not declare', (): void => {
    it('WHEN splitting THEN it is the out-file and the name comes from the root', (): void => {
      const expected: SchemaTarget = { schemaName: 'invoice', outFile: 'out.json' };

      expect(schemaTarget(pruned, 'out.json', undefined)).toStrictEqual(expected);
    });
  });

  describe('GIVEN one value a plain spec does not declare', (): void => {
    it('WHEN splitting THEN it stays a schema name so the sampler can suggest a fix', (): void => {
      const expected: SchemaTarget = { schemaName: 'invoic', outFile: undefined };

      expect(schemaTarget(plain, 'invoic', undefined)).toStrictEqual(expected);
    });
  });

  describe('GIVEN no values and a plain spec', (): void => {
    it('WHEN splitting THEN it asks for the schema name', (): void => {
      expect((): unknown => schemaTarget(plain, undefined, undefined)).toThrow('schema name required');
    });
  });
});
