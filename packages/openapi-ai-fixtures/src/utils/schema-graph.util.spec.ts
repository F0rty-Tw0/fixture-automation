import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { schemaGraph } from './schema-graph.util.ts';
import { OPENAPI_SPEC_STUB } from '../test/stubs/openapi-spec.stub.ts';

const MONEY = { $anchor: 'money', type: 'number' } as const;
const MONEY_REFERENCE = { $ref: '#/components/schemas/Money' };
const INVOICE_REFERENCE = { $ref: '#/components/schemas/Invoice' };
const INVOICE_PROPERTIES = { total: MONEY_REFERENCE, parent: INVOICE_REFERENCE };
const INVOICE = { type: 'object', properties: INVOICE_PROPERTIES } as const;
const ANCHOR_REFERENCE = { $ref: '#money' };
const SELF_REFERENCE = { $ref: '#self' };
const RECEIPT_PROPERTIES = { total: ANCHOR_REFERENCE };
const RECEIPT = { type: 'object', properties: RECEIPT_PROPERTIES } as const;
const SELF_ANCHORED_PROPERTIES = { total: SELF_REFERENCE };
const SELF_ANCHORED = { $anchor: 'self', type: 'object', properties: SELF_ANCHORED_PROPERTIES } as const;
const UNRELATED = { type: 'string' } as const;
const SIBLING_REFERENCE = { $ref: '#/components/schemas/Unrelated', properties: INVOICE_PROPERTIES } as const;
const SCHEMAS = {
  Invoice: INVOICE,
  Money: MONEY,
  Receipt: RECEIPT,
  Self: SELF_ANCHORED,
  Sibling: SIBLING_REFERENCE,
  Unrelated: UNRELATED
};
const COMPONENTS = { schemas: SCHEMAS };
const SPEC: OpenApiSpec = { ...OPENAPI_SPEC_STUB, components: COMPONENTS };

describe('FEATURE: reachable schema graph', (): void => {
  describe('GIVEN a spec whose target references other schemas', (): void => {
    describe('WHEN selecting the graph', (): void => {
      const graph = schemaGraph(SPEC, 'Invoice', 'openapi-31');

      it('THEN includes the target and every transitively referenced schema', (): void => {
        expect(graph).toStrictEqual({ Invoice: INVOICE, Money: MONEY });
      });

      it('THEN returns clones rather than the spec schemas', (): void => {
        expect(graph['Invoice']).not.toBe(INVOICE);
      });
    });
  });

  describe('GIVEN a target that references itself', (): void => {
    it('WHEN selecting the graph THEN visits it once', (): void => {
      expect(Object.keys(schemaGraph(SPEC, 'Invoice', 'openapi-31'))).toStrictEqual(['Invoice', 'Money']);
    });
  });

  describe('GIVEN a target with an anchor reference', (): void => {
    it('WHEN another schema owns the anchor THEN includes that schema', (): void => {
      expect(schemaGraph(SPEC, 'Receipt', 'openapi-31')).toStrictEqual({ Receipt: RECEIPT, Money: MONEY });
    });

    it('WHEN the target owns the anchor itself THEN includes only the target', (): void => {
      expect(schemaGraph(SPEC, 'Self', 'openapi-31')).toStrictEqual({ Self: SELF_ANCHORED });
    });
  });

  describe('GIVEN a target whose $ref has siblings', (): void => {
    it('WHEN the dialect is openapi-30 THEN follows only the $ref', (): void => {
      expect(schemaGraph(SPEC, 'Sibling', 'openapi-30')).toStrictEqual({ Sibling: SIBLING_REFERENCE, Unrelated: UNRELATED });
    });

    it('WHEN the dialect is openapi-31 THEN follows the sibling references too', (): void => {
      expect(Object.keys(schemaGraph(SPEC, 'Sibling', 'openapi-31'))).toStrictEqual(['Sibling', 'Unrelated', 'Money', 'Invoice']);
    });
  });

  describe('GIVEN a target that no schema declares', (): void => {
    it('WHEN selecting the graph THEN throws a FixtureError naming it', (): void => {
      expect((): unknown => schemaGraph(SPEC, 'Order', 'openapi-31')).toThrow('schema "Order" is unavailable');
    });

    it('WHEN selecting the graph THEN the fix lists the available schemas', (): void => {
      const fix = 'available: Invoice, Money, Receipt, Self, Sibling, ... (6 total)';

      expect((): unknown => schemaGraph(SPEC, 'Order', 'openapi-31')).toThrow(new FixtureError('schema "Order" is unavailable', fix));
    });

    it('WHEN the spec has no components THEN still throws a FixtureError', (): void => {
      expect((): unknown => schemaGraph({}, 'Order', 'openapi-31')).toThrow(FixtureError);
    });
  });
});
