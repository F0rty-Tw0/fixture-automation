import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { endpointMethods, endpointTags, filterEndpoints, groupByTag, isSupported } from './endpoint-filter.util.ts';
import { ENDPOINT_STUB } from '../../test/stubs/studio.stub.ts';
import { DEFAULT_ENDPOINT_FILTER } from '../common/spec.const.ts';
import type { EndpointFilter } from '../common/spec.type.ts';

const invoices: Endpoint = { ...ENDPOINT_STUB };
const createInvoice: Endpoint = { ...ENDPOINT_STUB, id: 'POST /v1/invoices', method: 'POST', summary: 'Create an invoice' };
const customer: Endpoint = { ...ENDPOINT_STUB, id: 'GET /v1/customers', path: '/v1/customers', summary: undefined, tags: ['Customers'] };
const health: Endpoint = { ...ENDPOINT_STUB, id: 'DELETE /health', method: 'DELETE', path: '/health', summary: 'Ping', tags: [] };
const endpoints = [health, invoices, createInvoice, customer];

const filterOf = (overrides: Partial<EndpointFilter>): EndpointFilter => {
  const filter: EndpointFilter = { ...DEFAULT_ENDPOINT_FILTER, ...overrides };

  return filter;
};

describe('FEATURE: endpoint filtering', (): void => {
  describe('GIVEN an empty filter', (): void => {
    it('WHEN filtering THEN keeps every endpoint in spec order', (): void => {
      const visible = filterEndpoints(endpoints, DEFAULT_ENDPOINT_FILTER);

      expect(visible).toStrictEqual(endpoints);
    });
  });

  describe('GIVEN a text query', (): void => {
    it('WHEN it matches a path THEN keeps only matching endpoints, case-insensitive', (): void => {
      const visible = filterEndpoints(endpoints, filterOf({ query: '  CUSTOMERS ' }));

      expect(visible).toStrictEqual([customer]);
    });

    it('WHEN it matches a summary THEN keeps that endpoint', (): void => {
      const visible = filterEndpoints(endpoints, filterOf({ query: 'create' }));

      expect(visible).toStrictEqual([createInvoice]);
    });
  });

  describe('GIVEN a tag', (): void => {
    it('WHEN it is a real tag THEN keeps endpoints carrying it', (): void => {
      const visible = filterEndpoints(endpoints, filterOf({ tag: 'Customers' }));

      expect(visible).toStrictEqual([customer]);
    });

    it('WHEN it is the untagged group THEN keeps endpoints without tags', (): void => {
      const visible = filterEndpoints(endpoints, filterOf({ tag: 'untagged' }));

      expect(visible).toStrictEqual([health]);
    });
  });

  describe('GIVEN a method', (): void => {
    it('WHEN combined with a tag THEN keeps endpoints matching both', (): void => {
      const visible = filterEndpoints(endpoints, filterOf({ tag: 'Invoices', method: 'POST' }));

      expect(visible).toStrictEqual([createInvoice]);
    });
  });
});

describe('FEATURE: endpoint grouping', (): void => {
  describe('GIVEN endpoints across tags', (): void => {
    it('WHEN grouped THEN groups by first tag in order of first appearance', (): void => {
      const groups = groupByTag(endpoints);

      expect(groups.map((group) => group.tag)).toStrictEqual(['untagged', 'Invoices', 'Customers']);
    });

    it('WHEN grouped THEN keeps spec order inside a group', (): void => {
      const groups = groupByTag(endpoints);

      expect(groups[1]?.endpoints).toStrictEqual([invoices, createInvoice]);
    });
  });

  it('GIVEN no endpoints WHEN grouped THEN returns no groups', (): void => {
    expect(groupByTag([])).toStrictEqual([]);
  });
});

describe('FEATURE: endpoint facets', (): void => {
  describe('GIVEN endpoints across tags and methods', (): void => {
    it('WHEN listing tags THEN returns unique tags sorted, untagged included', (): void => {
      expect(endpointTags(endpoints)).toStrictEqual(['Customers', 'Invoices', 'untagged']);
    });

    it('WHEN listing methods THEN returns unique methods in HTTP order', (): void => {
      expect(endpointMethods(endpoints)).toStrictEqual(['GET', 'POST', 'DELETE']);
    });

    it('WHEN a method is non-standard THEN sorts it last', (): void => {
      const custom: Endpoint = { ...ENDPOINT_STUB, method: 'QUERY' };

      expect(endpointMethods([custom, invoices])).toStrictEqual(['GET', 'QUERY']);
    });
  });
});

describe('FEATURE: endpoint support', (): void => {
  it('GIVEN a named response schema WHEN checked THEN is supported', (): void => {
    expect(isSupported(ENDPOINT_STUB)).toBe(true);
  });

  it('GIVEN no response schema WHEN checked THEN is unsupported', (): void => {
    const inline: Endpoint = { ...ENDPOINT_STUB, schemaName: null, unsupportedReason: 'Inline schema' };

    expect(isSupported(inline)).toBe(false);
  });
});
