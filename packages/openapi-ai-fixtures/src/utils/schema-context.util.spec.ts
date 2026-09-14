import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { prepareSchema } from './schema-context.util.ts';
import { schemaFixtureUrl, schemaNames } from '../test/utils/schema-context.spec.util.ts';

describe('FEATURE: fixture schema preparation', (): void => {
  let draft07: OpenApiSpec;
  let openApi30: OpenApiSpec;
  let openApi31: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    draft07 = await loadSpec(schemaFixtureUrl('draft-07.json'));
    openApi30 = await loadSpec(schemaFixtureUrl('openapi-30.json'));
    openApi31 = await loadSpec(schemaFixtureUrl('openapi-31.json'));
  });

  describe('GIVEN a draft-07 component schema with local dependencies', (): void => {
    it('WHEN preparing a fixture schema THEN it validates constraints without changing its source', (): void => {
      const before = JSON.stringify(draft07);
      const prepared = prepareSchema(draft07, 'Invoice');
      const names = schemaNames(prepared.context);
      const validOwner = { kind: 'person', email: 'owner@example.com' };
      const invalidOwner = { kind: 'company', email: 'not-an-email' };
      const validInvoice = {
        id: 'a9ef1b8d-cc93-4b17-89af-a422a1e2cfd4',
        status: 'open',
        owner: validOwner
      };
      const invalidInvoice = {
        id: 'not-a-uuid',
        status: 'closed',
        owner: invalidOwner
      };
      const missingOwner = {
        id: 'a9ef1b8d-cc93-4b17-89af-a422a1e2cfd4',
        status: 'open'
      };

      expect(prepared.validate(validInvoice)).toBe(true);
      expect(prepared.validate(invalidInvoice)).toBe(false);
      expect(prepared.validate(missingOwner)).toBe(false);
      expect(names).toStrictEqual(['Invoice', 'Owner']);
      expect(JSON.stringify(draft07)).toBe(before);
    });
  });

  describe('GIVEN a component graph containing escaped names and a cycle', (): void => {
    it('WHEN preparing the root THEN it retains and validates the transitive graph', (): void => {
      const prepared = prepareSchema(draft07, 'Root');
      const parent = { name: 'parent' };
      const validChild = { name: 'child', parent };
      const missingName = { parent };

      expect(prepared.validate(validChild)).toBe(true);
      expect(prepared.validate(missingName)).toBe(false);
      expect(schemaNames(prepared.context)).toStrictEqual(['Child/node', 'Root']);
    });
  });

  describe('GIVEN schema names overlapping object prototype properties', (): void => {
    it('WHEN following local references THEN it validates actual own definitions', (): void => {
      const prepared = prepareSchema(draft07, 'PrototypeRoot');

      expect(prepared.validate('valid')).toBe(true);
      expect(prepared.validate('no')).toBe(false);
    });
  });

  describe('GIVEN a draft-07 reference object with assertion siblings', (): void => {
    it('WHEN preparing the reference THEN it ignores the siblings', (): void => {
      const prepared = prepareSchema(draft07, 'RefSibling');

      expect(prepared.validate('valid')).toBe(true);
      expect(prepared.validate('no')).toBe(false);
    });
  });

  describe('GIVEN a draft-07 fragment identifier', (): void => {
    it('WHEN preparing the reference THEN it resolves the local fragment', (): void => {
      const prepared = prepareSchema(draft07, 'FragmentRoot');

      expect(prepared.validate('valid')).toBe(true);
      expect(prepared.validate('no')).toBe(false);
    });
  });

  describe('GIVEN modern JSON Schema assertions without a declared OpenAPI version', (): void => {
    it('WHEN preparing unevaluated properties THEN it rejects the unsupported assertion', (): void => {
      expect((): unknown => prepareSchema(draft07, 'ModernUnevaluated')).toThrow(/unevaluatedProperties/);
    });

    it('WHEN preparing prefix items THEN it rejects the unsupported assertion', (): void => {
      expect((): unknown => prepareSchema(draft07, 'ModernPrefix')).toThrow(/prefixItems/);
    });

    it('WHEN preparing dependent requirements THEN it rejects the unsupported assertion', (): void => {
      expect((): unknown => prepareSchema(draft07, 'ModernDependent')).toThrow(/dependentRequired/);
    });
  });

  describe('GIVEN an OpenAPI 3.0 schema with nullable enum values', (): void => {
    it('WHEN preparing the schema THEN it retains enum restrictions for null values', (): void => {
      const prepared = prepareSchema(openApi30, 'Balance');
      const validBalance = { amount: 1, label: null, status: 'open' };
      const exclusiveMinimumBalance = { amount: 0, label: 'open', status: 'open' };
      const invalidEnumBalance = { amount: 1, label: 'closed', status: 'open' };
      const nullOutsideEnum = { amount: 1, label: 'open', status: null };

      expect(prepared.validate(validBalance)).toBe(true);
      expect(prepared.validate(exclusiveMinimumBalance)).toBe(false);
      expect(prepared.validate(invalidEnumBalance)).toBe(false);
      expect(prepared.validate(nullOutsideEnum)).toBe(false);
    });

    it('WHEN nullable has no type THEN it treats either annotation value as a no-op', (): void => {
      const falsePrepared = prepareSchema(openApi30, 'NullableNoType');
      const truePrepared = prepareSchema(openApi30, 'NullableTrueNoType');

      expect(falsePrepared.validate('ready')).toBe(true);
      expect(falsePrepared.validate(null)).toBe(false);
      expect(truePrepared.validate('ready')).toBe(true);
      expect(truePrepared.validate(null)).toBe(false);
    });
  });

  describe('GIVEN an OpenAPI 3.0 vendor extension', (): void => {
    it('WHEN preparing the schema THEN it retains standard validation', (): void => {
      const prepared = prepareSchema(openApi30, 'VendorExtension');

      expect(prepared.validate('value')).toBe(true);
      expect(prepared.validate(1)).toBe(false);
    });
  });

  describe('GIVEN an OpenAPI 3.0 reference object with assertion siblings', (): void => {
    it('WHEN preparing the reference THEN it ignores the siblings', (): void => {
      const prepared = prepareSchema(openApi30, 'ReferenceSibling');

      expect(prepared.validate('valid')).toBe(true);
      expect(prepared.validate('no')).toBe(false);
    });
  });

  describe('GIVEN JSON Schema keywords outside the OpenAPI 3.0 subset', (): void => {
    it('WHEN preparing pattern properties THEN it rejects the unsupported keyword', (): void => {
      expect((): unknown => prepareSchema(openApi30, 'UnsupportedPatternProperties')).toThrow(/patternProperties/);
    });

    it('WHEN preparing dependencies THEN it rejects the unsupported keyword', (): void => {
      expect((): unknown => prepareSchema(openApi30, 'UnsupportedDependencies')).toThrow(/dependencies/);
    });

    it('WHEN preparing definitions THEN it rejects the unsupported keyword', (): void => {
      expect((): unknown => prepareSchema(openApi30, 'UnsupportedDefinitions')).toThrow(/definitions/);
    });

    it('WHEN preparing additional items THEN it rejects the unsupported keyword', (): void => {
      expect((): unknown => prepareSchema(openApi30, 'UnsupportedAdditionalItems')).toThrow(/additionalItems/);
    });

    it('WHEN preparing tuple items THEN it rejects the unsupported array form', (): void => {
      expect((): unknown => prepareSchema(openApi30, 'UnsupportedTupleItems')).toThrow(/items object/);
    });

    it('WHEN preparing a boolean subschema THEN it rejects the non-object schema', (): void => {
      expect((): unknown => prepareSchema(openApi30, 'UnsupportedBooleanSubschema')).toThrow(/Schema Objects/);
    });

    it('WHEN preparing a null type THEN it rejects the non-OpenAPI type', (): void => {
      expect((): unknown => prepareSchema(openApi30, 'UnsupportedNullType')).toThrow(/null type/);
    });
  });

  describe('GIVEN an OpenAPI 3.1 schema using draft 2020-12 keywords', (): void => {
    it('WHEN preparing the schema THEN it enforces tuple and null type constraints', (): void => {
      const coordinate = prepareSchema(openApi31, 'Coordinate');
      const text = prepareSchema(openApi31, 'OptionalText');

      expect(coordinate.validate(['north', 12])).toBe(true);
      expect(coordinate.validate(['north', '12'])).toBe(false);
      expect(text.validate(null)).toBe(true);
      expect(text.validate(12)).toBe(false);
    });
  });

  describe('GIVEN OpenAPI 3.1 without a jsonSchemaDialect declaration', (): void => {
    it('WHEN preparing the schema THEN it uses the OpenAPI 3.1 default dialect', async (): Promise<void> => {
      const defaultDialect = await loadSpec(schemaFixtureUrl('openapi-31-default.json'));
      const prepared = prepareSchema(defaultDialect, 'Value');

      expect(prepared.validate(null)).toBe(true);
      expect(prepared.validate(1)).toBe(false);
    });
  });

  describe('GIVEN a selected OpenAPI 3.1 graph with fragment references', (): void => {
    it('WHEN preparing the root THEN it resolves dynamic anchors and resource-root references', (): void => {
      const prepared = prepareSchema(openApi31, 'Root');
      const child = { value: 'child' };
      const self = { value: 'self' };
      const validNode = {
        value: 'root',
        child,
        self
      };
      const invalidNode = { child };

      expect(prepared.validate(validNode)).toBe(true);
      expect(prepared.validate(invalidNode)).toBe(false);
    });
  });

  describe('GIVEN fragment anchors in separate schema resources', (): void => {
    it('WHEN preparing the document-local reference THEN it ignores other resource anchors', (): void => {
      const prepared = prepareSchema(openApi31, 'DocumentAnchorRoot');

      expect(prepared.validate('valid')).toBe(true);
      expect(prepared.validate('no')).toBe(false);
    });
  });

  describe('GIVEN an empty resource identifier', (): void => {
    it('WHEN following a document anchor THEN it retains the current resource', (): void => {
      const prepared = prepareSchema(openApi31, 'EmptyIdentifierRoot');

      expect(prepared.validate('valid')).toBe(true);
      expect(prepared.validate('no')).toBe(false);
    });
  });

  describe('GIVEN a schema format outside the known set', (): void => {
    it('WHEN preparing the schema THEN it accepts the format and keeps type validation', (): void => {
      const prepared = prepareSchema(draft07, 'UnknownFormat');

      expect(prepared.validate(1700000000)).toBe(true);
      expect(prepared.validate('1700000000')).toBe(false);
    });
  });

  describe('GIVEN unsupported schema constructs', (): void => {
    it('WHEN preparing an external reference THEN it rejects the reference', (): void => {
      expect((): unknown => prepareSchema(openApi31, 'External')).toThrow(/external/i);
    });

    it('WHEN preparing an unresolved reference THEN it rejects the reference', (): void => {
      expect((): unknown => prepareSchema(draft07, 'Unresolved')).toThrow(/unresolved/i);
    });

    it('WHEN preparing OpenAPI 3.1 nullable THEN it rejects the obsolete annotation', (): void => {
      expect((): unknown => prepareSchema(openApi31, 'Nullable')).toThrow(/nullable/);
    });

    it('WHEN preparing an incompatible resource dialect THEN it rejects the resource', (): void => {
      expect((): unknown => prepareSchema(openApi31, 'IncompatibleResourceDialect')).toThrow(/resource dialect/);
    });

    it('WHEN preparing an invalid OpenAPI version THEN it rejects the version', async (): Promise<void> => {
      const invalidVersion = await loadSpec(schemaFixtureUrl('invalid-openapi-version.json'));

      expect((): unknown => prepareSchema(invalidVersion, 'Value')).toThrow(/unsupported OpenAPI version/);
    });
  });

  describe('GIVEN an overflowing JSON number', (): void => {
    it('WHEN validating the number THEN it rejects the non-finite result', (): void => {
      const value: unknown = JSON.parse('1e400');
      const prepared = prepareSchema(draft07, 'Value');

      expect(prepared.validate(value)).toBe(false);
    });
  });
});
