import { strict as assert } from 'node:assert';

import { describe, expect, it } from 'vitest';

import { diffFixture } from './fixture-diff.ts';
import type { SpecSchema } from '../../schema/common/schema.type.ts';
import { isSchema } from '../../schema/utils/schema-record.util.ts';
import { dropPaths } from '../../shared/fixture-path/utils/drop-path.util.ts';
import { cyclicOrder, nestedOrder, nestedSpec } from '../../test/utils/nested-spec.spec.util.ts';
import type { BrokenEntry } from '../common/missing.type.ts';

const DROPPED = ['id', 'customer.email', 'lines[1].sku'];
const CYCLE_PATHS = ['parent.id', 'parent.created', 'parent.note', 'parent.customer', 'parent.lines'];
const REFERENCED_NAMES = ['customer', 'party'];

describe('FEATURE: missing-field diff against an OpenAPI schema', (): void => {
  describe('GIVEN a fixture whose required fields were dropped at every depth', (): void => {
    it('WHEN diffing required fields only THEN the paths name the top level, nested object and array element', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = dropPaths(await nestedOrder(), DROPPED);

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });

      expect(diff.paths).toStrictEqual(DROPPED);
    });

    it('WHEN diffing every field THEN the optional cycle property joins the required paths', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = dropPaths(await nestedOrder(), DROPPED);
      const expected = [...DROPPED, 'parent'];

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: false });

      expect(diff.paths).toStrictEqual(expected);
    });

    it('WHEN none of the missing sub-schemas reference a component THEN components carries no schema', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = dropPaths(await nestedOrder(), DROPPED);

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });
      const names = Object.keys(diff.components.schemas);

      expect(diff.dialect).toBe('openapi-30');
      expect(names).toStrictEqual([]);
    });
  });

  describe('GIVEN a fixture whose schema payload is wrapped in body', (): void => {
    it('WHEN diffing required fields only THEN present body fields stay present and the missing schema keeps the body envelope', async (): Promise<void> => {
      const spec = await nestedSpec();
      const body = dropPaths(await nestedOrder(), DROPPED);
      const fixture = { body };
      const expectedPaths = DROPPED.map((path) => `body.${path}`);

      const request = { spec, schemaName: 'order', fixture, requiredOnly: true, objectShape: 'body' };
      const bodyProjection = { type: 'object', required: ['id', 'customer', 'lines'] };
      const properties = { body: bodyProjection };
      const expected = { type: 'object', required: ['body'], properties };

      const diff = diffFixture(request);

      expect(diff.paths).toStrictEqual(expectedPaths);
      expect(diff.schema).toMatchObject(expected);
    });

    it('WHEN the envelope key includes dots THEN the projected schema keeps that literal property key', async (): Promise<void> => {
      const objectShape = 'response.body';
      const spec = await nestedSpec();
      const payload = dropPaths(await nestedOrder(), ['id']);
      const fixture = { [objectShape]: payload };

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true, objectShape });
      const properties = diff.schema.properties ?? {};

      expect(diff.paths).toStrictEqual(['response.body.id']);
      expect(Object.keys(properties)).toStrictEqual([objectShape]);
    });

    it('WHEN the body envelope is absent THEN the diff fails instead of comparing the root fixture', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = await nestedOrder();

      expect((): unknown => diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true, objectShape: 'body' })).toThrow();
    });

    it('WHEN body is an array THEN paths and the missing schema preserve array indices', async (): Promise<void> => {
      const source = await nestedSpec();
      const id: SpecSchema = { type: 'string' };
      const properties = { id };
      const items: SpecSchema = { type: 'object', required: ['id'], properties };
      const rows: SpecSchema = { type: 'array', items };
      const schemas = { rows };
      const components = { schemas };
      const spec = { ...source, components };
      const body = [{}];
      const fixture = { body };
      const request = { spec, schemaName: 'rows', fixture, requiredOnly: true, objectShape: 'body' };
      const bodyProjection = { type: 'array', items };
      const envelopeProperties = { body: bodyProjection };
      const expected = { type: 'object', required: ['body'], properties: envelopeProperties };

      const diff = diffFixture(request);

      expect(diff.paths).toStrictEqual(['body[0].id']);
      expect(diff.schema).toMatchObject(expected);
    });
  });

  describe('GIVEN a list fixture diffed against its item schema', (): void => {
    it('WHEN diffing required fields only THEN each element reports its own missing paths', async (): Promise<void> => {
      const spec = await nestedSpec();
      const second = dropPaths(await nestedOrder(), ['id', 'customer.email']);
      const fixture = [await nestedOrder(), second];

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });

      expect(diff.paths).toStrictEqual(['[1].id', '[1].customer.email']);
    });

    it('WHEN diffing THEN the missing schema is an array of the element projection', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = [dropPaths(await nestedOrder(), ['id'])];
      const items = { type: 'object', required: ['id'] };
      const expected = { type: 'array', items };

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });

      expect(diff.schema).toMatchObject(expected);
    });

    it('WHEN an element holds a value of the wrong type THEN it is broken under its index', async (): Promise<void> => {
      const spec = await nestedSpec();
      const order = await nestedOrder();
      const stale = { ...order, created: 'yesterday' };
      const fixture = [order, stale];
      const expected: BrokenEntry = { path: '[1].created', value: 'yesterday', reason: 'must be integer' };

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });

      expect(diff.broken).toStrictEqual([expected]);
    });

    it('WHEN replacing broken values THEN the baseline stays a list without that element value', async (): Promise<void> => {
      const spec = await nestedSpec();
      const order = await nestedOrder();
      const stale = { ...order, created: 'yesterday' };
      const fixture = [order, stale];
      const undated = dropPaths(order, ['created']);

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true, replacePlaceholders: true });

      expect(diff.replaced).toStrictEqual(['[1].created']);
      expect(diff.baseline).toStrictEqual([order, undated]);
    });
  });

  describe('GIVEN a present optional value of the wrong type', (): void => {
    it('WHEN diffing required fields only THEN it is listed as broken but neither missing nor replaced', async (): Promise<void> => {
      const spec = await nestedSpec();
      const order = await nestedOrder();
      const fixture = { ...order, note: 5 };
      const expected: BrokenEntry = { path: 'note', value: 5, reason: 'must be string,null' };

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true, replacePlaceholders: true });

      expect(diff.broken).toStrictEqual([expected]);
      expect(diff.paths).toStrictEqual([]);
      expect(diff.replaced).toStrictEqual([]);
    });
  });

  describe('GIVEN a missing property whose sub-schema references another component', (): void => {
    it('WHEN diffing THEN components carries that schema and the ones it references in turn', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = dropPaths(await nestedOrder(), ['customer']);

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });
      const names = Object.keys(diff.components.schemas).sort();

      expect(diff.paths).toStrictEqual(['customer']);
      expect(names).toStrictEqual(REFERENCED_NAMES);
    });
  });

  describe('GIVEN a fixture whose anyOf property is absent', (): void => {
    it('WHEN diffing THEN the missing schema keeps only the first union member and references nothing', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = dropPaths(await nestedOrder(), ['lines[1].source']);

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });
      const lines = diff.schema.properties?.['lines'];

      assert(isSchema(lines), 'expected lines schema');

      const items = lines.items;

      assert(isSchema(items), 'expected items schema');

      const source = items.properties?.['source'];

      const supplierRef = { $ref: '#/components/schemas/supplier' };
      const expansionResources = { oneOf: [supplierRef] };
      const stringBranch = { type: 'string' };
      const expected = { anyOf: [stringBranch], 'x-expansionResources': expansionResources };

      expect(diff.paths).toStrictEqual(['lines[1].source']);
      expect(source).toStrictEqual(expected);
      expect(Object.keys(diff.components.schemas)).toStrictEqual([]);
    });
  });

  describe('GIVEN a fixture whose anyOf member resolves to an object branch', (): void => {
    it('WHEN diffing every field THEN the branch property is reported under its array index', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = dropPaths(await nestedOrder(), ['lines[0].source.region']);
      const expected = ['lines[0].source.region', 'parent'];

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: false });

      expect(diff.paths).toStrictEqual(expected);
    });
  });

  describe('GIVEN a fixture whose cyclic property bottomed out as an empty object', (): void => {
    it('WHEN diffing every field THEN every property of the empty object is missing', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = await cyclicOrder();

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: false });

      expect(diff.paths).toStrictEqual(CYCLE_PATHS);
    });
  });

  describe('GIVEN a fixture shaped like the sampler leaves it at a cycle', (): void => {
    it('WHEN diffing every field THEN the omitted cyclic property is not missing', async (): Promise<void> => {
      const spec = await nestedSpec();
      const order = await nestedOrder();
      const fixture = { ...order, parent: order };

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: false });

      expect(diff.paths).toStrictEqual([]);
    });
  });

  describe('GIVEN a complete fixture', (): void => {
    it('WHEN diffing required fields only THEN no path is missing', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = await nestedOrder();

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true });

      expect(diff.paths).toStrictEqual([]);
    });

    it('WHEN a blank object shape is supplied THEN the fixture root remains the payload', async (): Promise<void> => {
      const spec = await nestedSpec();
      const fixture = await nestedOrder();

      const diff = diffFixture({ spec, schemaName: 'order', fixture, requiredOnly: true, objectShape: '   ' });

      expect(diff.paths).toStrictEqual([]);
    });
  });
});
