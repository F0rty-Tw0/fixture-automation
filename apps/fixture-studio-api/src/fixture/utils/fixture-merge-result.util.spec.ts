import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { fixtureMergeResult } from './fixture-merge-result.util.ts';
import type { MergeBody } from '../../contract/common/studio-api.type.ts';
import { studioSpec } from '../../test/utils/studio-spec.spec.util.ts';

const PARTIAL_INVOICE = { id: 'in_9', amount_due: 5 };
const ENDPOINT_ID = 'GET /v1/invoices/{id}';
const LIST_ENDPOINT_ID = 'GET /v1/invoices';

describe('FEATURE: fixture merge result', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN populated values that satisfy the schema', (): void => {
    it('WHEN merged THEN is valid with the filled paths and pretty JSON', (): void => {
      const populated = { status: 'open', memo: 'hi' };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, populated };

      const result = fixtureMergeResult(spec, 'invoice', body);

      const merged = { ...PARTIAL_INVOICE, ...populated };

      expect(result).toStrictEqual({
        mergedJson: `${JSON.stringify(merged, null, 2)}\n`,
        filled: ['status', 'memo'],
        valid: true,
        errors: []
      });
    });
  });

  describe('GIVEN populated values that violate the schema', (): void => {
    it('WHEN merged THEN is invalid with path: message errors, still carrying the merged JSON', (): void => {
      const populated = { status: 'closed' };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, populated };

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result.valid).toBe(false);
      expect(result.errors).toStrictEqual(['/status: must be equal to one of the allowed values']);
      expect(result.mergedJson).toContain('"status": "closed"');
    });
  });

  describe('GIVEN a baseline cut from an original fixture', (): void => {
    it('WHEN merged with the original THEN each refilled key keeps its original place', (): void => {
      const original = { id: 'in_9', amount_due: 0, status: 'open' };
      const fixture = { id: 'in_9', status: 'open' };
      const populated = { amount_due: 5 };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture, populated, original };

      const result = fixtureMergeResult(spec, 'invoice', body);

      const merged: unknown = JSON.parse(result.mergedJson);

      expect(Object.keys(merged ?? {})).toStrictEqual(['id', 'amount_due', 'status']);
    });

    it('WHEN merged without the original THEN refilled keys follow the kept ones', (): void => {
      const fixture = { id: 'in_9', status: 'open' };
      const populated = { amount_due: 5 };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture, populated };

      const result = fixtureMergeResult(spec, 'invoice', body);

      const merged: unknown = JSON.parse(result.mergedJson);

      expect(Object.keys(merged ?? {})).toStrictEqual(['id', 'status', 'amount_due']);
    });
  });

  describe('GIVEN an object-shape envelope', (): void => {
    it('WHEN merged THEN validates only the payload inside it', (): void => {
      const fixture = { data: PARTIAL_INVOICE, meta: 'not an invoice field' };
      const populatedData = { status: 'open' };
      const populated = { data: populatedData };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture, populated, objectShape: 'data' };

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result).toMatchObject({ valid: true, filled: ['data.status'] });
    });

    it('WHEN merged with the original envelope THEN the envelope and its payload keep the original order', (): void => {
      const originalData = { status: 'draft', id: 'in_9', amount_due: 5 };
      const original = { meta: 'first', data: originalData };
      const fixture = { data: PARTIAL_INVOICE, meta: 'first' };
      const populatedData = { status: 'open' };
      const populated = { data: populatedData };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture, populated, objectShape: 'data', original };
      const expectedData = { status: 'open', id: 'in_9', amount_due: 5 };
      const expected = { meta: 'first', data: expectedData };

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result.mergedJson).toBe(`${JSON.stringify(expected, null, 2)}\n`);
    });

    it('WHEN the fixture lacks the envelope key but another property holds the payload THEN merges and validates that property', (): void => {
      const meta = { page: 1 };
      const fixture = { meta, items: PARTIAL_INVOICE };
      const populatedItems = { status: 'open' };
      const populated = { items: populatedItems };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture, populated, objectShape: 'data' };

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result).toMatchObject({ valid: true, errors: [], filled: ['items.status'] });
    });

    it('WHEN the fixture lacks the envelope key THEN merges and validates the whole fixture instead of failing', (): void => {
      const populated = { status: 'open' };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture: PARTIAL_INVOICE, populated, objectShape: 'data' };

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result).toMatchObject({ valid: true, filled: ['status'] });
    });

    it('WHEN the fixture lacks the envelope key and nothing looks like the payload THEN nothing is merged and it is not valid', (): void => {
      const meta = { page: 1 };
      const fixture = { meta, total: 3 };
      const populated = { id: 'in_7', amount_due: 7, status: 'open' };
      const body: MergeBody = { endpointId: ENDPOINT_ID, fixture, populated, objectShape: 'data' };
      const error = 'The fixture has no "data" property and nothing in it looks like the payload, so nothing was merged.';

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result).toStrictEqual({ mergedJson: `${JSON.stringify(fixture, null, 2)}\n`, filled: [], valid: false, errors: [error] });
    });
  });

  describe('GIVEN a list fixture for an endpoint answering a list of invoices', (): void => {
    it('WHEN merged THEN each element is validated against the invoice schema', (): void => {
      const populatedInvoice = { status: 'open' };
      const body: MergeBody = { endpointId: LIST_ENDPOINT_ID, fixture: [PARTIAL_INVOICE], populated: [populatedInvoice] };

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result).toMatchObject({ valid: true, errors: [], filled: ['[0].status'] });
    });

    it('WHEN an element violates the schema THEN the error names it by index', (): void => {
      const populatedInvoice = { status: 'closed' };
      const body: MergeBody = { endpointId: LIST_ENDPOINT_ID, fixture: [PARTIAL_INVOICE], populated: [populatedInvoice] };

      const result = fixtureMergeResult(spec, 'invoice', body);

      expect(result.errors).toStrictEqual(['/0/status: must be equal to one of the allowed values']);
    });
  });
});
