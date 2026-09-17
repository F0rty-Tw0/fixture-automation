import { describe, expect, it } from 'vitest';

import { fragmentAnchorOwner, schemaAnchors } from './schema-anchor.util.ts';
import type { SchemaAnchorOwner, SchemaAnchorOwners } from '../common/schema.type.ts';

const ANCHORED = { $anchor: 'money', type: 'number' };
const DYNAMIC = { $dynamicAnchor: 'node', type: 'object' };
const NESTED_ANCHOR = { $anchor: 'status', type: 'string' };
const NESTED_PROPERTIES = { status: NESTED_ANCHOR };
const NESTED = { type: 'object', properties: NESTED_PROPERTIES };
const NAMED_RESOURCE = { $id: 'https://example.com/money', $anchor: 'money' };
const NAMED_RESOURCE_PROPERTIES = { total: NAMED_RESOURCE };
const NAMED_RESOURCE_PARENT = { type: 'object', properties: NAMED_RESOURCE_PROPERTIES };
const REFERENCE_SIBLING = { $ref: '#/components/schemas/Other', properties: NESTED_PROPERTIES };
const SPACED = { $anchor: 'my anchor' };

const ownersOf = (map: SchemaAnchorOwners, name: string): SchemaAnchorOwner | undefined => map.get(name);

describe('FEATURE: schema anchor ownership', (): void => {
  describe('GIVEN openapi-30 schemas', (): void => {
    it('WHEN collecting anchors THEN returns an empty map', (): void => {
      expect(schemaAnchors({ Money: ANCHORED }, 'openapi-30').size).toBe(0);
    });
  });

  describe('GIVEN openapi-31 schemas', (): void => {
    it('WHEN a schema declares $anchor THEN the schema owns it as a document resource', (): void => {
      const expected: SchemaAnchorOwner = { documentOwners: ['Money'], owners: ['Money'] };

      expect(ownersOf(schemaAnchors({ Money: ANCHORED }, 'openapi-31'), 'money')).toStrictEqual(expected);
    });

    it('WHEN a schema declares $dynamicAnchor THEN collects it', (): void => {
      expect(schemaAnchors({ Node: DYNAMIC }, 'openapi-31').has('node')).toBe(true);
    });

    it('WHEN an anchor sits below properties THEN the root schema owns it', (): void => {
      const expected: SchemaAnchorOwner = { documentOwners: ['Invoice'], owners: ['Invoice'] };

      expect(ownersOf(schemaAnchors({ Invoice: NESTED }, 'openapi-31'), 'status')).toStrictEqual(expected);
    });

    it('WHEN a nested $id names its own resource THEN its anchor is not a document owner', (): void => {
      const expected: SchemaAnchorOwner = { documentOwners: [], owners: ['Invoice'] };

      expect(ownersOf(schemaAnchors({ Invoice: NAMED_RESOURCE_PARENT }, 'openapi-31'), 'money')).toStrictEqual(expected);
    });

    it('WHEN a root $id is an empty string THEN the schema stays a document resource', (): void => {
      const schema = { $id: '', $anchor: 'money' };

      expect(ownersOf(schemaAnchors({ Money: schema }, 'openapi-31'), 'money')?.documentOwners).toStrictEqual(['Money']);
    });

    it('WHEN two schemas declare the same anchor THEN both are owners', (): void => {
      const expected: SchemaAnchorOwner = { documentOwners: ['A', 'B'], owners: ['A', 'B'] };

      expect(ownersOf(schemaAnchors({ A: ANCHORED, B: ANCHORED }, 'openapi-31'), 'money')).toStrictEqual(expected);
    });

    it('WHEN a $ref has siblings THEN still collects anchors below them', (): void => {
      expect(schemaAnchors({ Invoice: REFERENCE_SIBLING }, 'openapi-31').has('status')).toBe(true);
    });

    it('WHEN a schema is a boolean THEN collects nothing', (): void => {
      expect(schemaAnchors({ Anything: true }, 'openapi-31').size).toBe(0);
    });
  });

  describe('GIVEN draft-07 schemas', (): void => {
    it('WHEN $id is a fragment THEN treats it as an anchor', (): void => {
      const schema = { $id: '#money', type: 'number' };

      expect(schemaAnchors({ Money: schema }, 'draft-07').has('money')).toBe(true);
    });

    it('WHEN $id is a URI THEN it is not an anchor', (): void => {
      expect(schemaAnchors({ Money: NAMED_RESOURCE }, 'draft-07').has('https://example.com/money')).toBe(false);
    });

    it('WHEN a $ref has siblings THEN ignores anchors below them', (): void => {
      expect(schemaAnchors({ Invoice: REFERENCE_SIBLING }, 'draft-07').size).toBe(0);
    });
  });

  describe('GIVEN a fragment reference', (): void => {
    const anchors = schemaAnchors({ Money: ANCHORED, Invoice: NESTED }, 'openapi-31');

    it('WHEN the reference is the bare root THEN resolves to no other schema', (): void => {
      expect(fragmentAnchorOwner('#', 'Invoice', anchors, 'openapi-31')).toBeUndefined();
    });

    it('WHEN another schema owns the anchor THEN returns that schema', (): void => {
      expect(fragmentAnchorOwner('#money', 'Invoice', anchors, 'openapi-31')).toBe('Money');
    });

    it('WHEN the source schema owns the anchor THEN resolves to no other schema', (): void => {
      expect(fragmentAnchorOwner('#status', 'Invoice', anchors, 'openapi-31')).toBeUndefined();
    });

    it('WHEN the anchor is percent-encoded THEN decodes it before lookup', (): void => {
      const encoded = schemaAnchors({ Spaced: SPACED }, 'openapi-31');

      expect(fragmentAnchorOwner('#my%20anchor', 'Other', encoded, 'openapi-31')).toBe('Spaced');
    });

    it('WHEN nothing owns the anchor THEN throws', (): void => {
      const resolve = (): unknown => fragmentAnchorOwner('#missing', 'Invoice', anchors, 'openapi-31');

      expect(resolve).toThrow('unresolved local schema anchor "#missing"');
    });

    it('WHEN two other schemas own the anchor THEN throws', (): void => {
      const shared = schemaAnchors({ A: ANCHORED, B: ANCHORED }, 'openapi-31');
      const resolve = (): unknown => fragmentAnchorOwner('#money', 'C', shared, 'openapi-31');

      expect(resolve).toThrow('ambiguous local schema anchor "#money"');
    });

    it('WHEN only a named resource owns the anchor THEN throws', (): void => {
      const named = schemaAnchors({ Invoice: NAMED_RESOURCE_PARENT }, 'openapi-31');
      const resolve = (): unknown => fragmentAnchorOwner('#money', 'Other', named, 'openapi-31');

      expect(resolve).toThrow('ambiguous local schema anchor "#money"');
    });

    it('WHEN the encoding is malformed THEN throws', (): void => {
      const resolve = (): unknown => fragmentAnchorOwner('#%E0%A4%A', 'Invoice', anchors, 'openapi-31');

      expect(resolve).toThrow('invalid schema reference "#%E0%A4%A"');
    });

    it('WHEN the dialect is openapi-30 THEN throws', (): void => {
      const resolve = (): unknown => fragmentAnchorOwner('#money', 'Invoice', anchors, 'openapi-30');

      expect(resolve).toThrow('unsupported local schema reference "#money"');
    });
  });

  describe('GIVEN an external reference', (): void => {
    it('WHEN resolving THEN throws', (): void => {
      const resolve = (): unknown => fragmentAnchorOwner('other.json#money', 'Invoice', new Map(), 'openapi-31');

      expect(resolve).toThrow('external schema reference "other.json#money" is not supported');
    });
  });
});
