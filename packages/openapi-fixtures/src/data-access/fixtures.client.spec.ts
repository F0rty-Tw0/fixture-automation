import { isRecord } from '@fixture-automation/shared';
import type { ValidateFunction } from 'ajv';
import type { JSONSchema7 } from 'json-schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { fixtures, loadSpec } from '@fixture-automation/openapi-fixtures';

import type { OpenApiSpec } from '../common/openapi.type.ts';
import type { TestComponents } from '../test/common/invoice.type.ts';
import { fixtureUrl } from '../test/utils/fixture-url.spec.util.ts';
import { invoiceValidator } from '../test/utils/invoice-validator.spec.util.ts';

describe('FEATURE: OpenAPI fixtures', (): void => {
  describe('GIVEN an invoice schema in a JSON spec file', (): void => {
    let spec: OpenApiSpec;
    let validate: ValidateFunction;

    beforeEach(async (): Promise<void> => {
      spec = await loadSpec(fixtureUrl());
      validate = invoiceValidator(spec);
    });

    it('WHEN sampled THEN produces deterministic schema-valid values', (): void => {
      const fx = fixtures<TestComponents>(spec);

      const invoice = fx('invoice');

      expect(invoice.id).toBe('in_123');
      expect(invoice.status).toBe('draft');
      expect(typeof invoice.amount_due).toBe('number');
      expect(invoice.memo).toBe('string');
      expect(validate(invoice)).toBe(true);
    });

    it('WHEN skipping non-required fields THEN omits optional fields and stays schema-valid', (): void => {
      const fx = fixtures<TestComponents>(spec, { skipNonRequired: true });

      const invoice = fx('invoice');

      expect(invoice.memo).toBeUndefined();
      expect(validate(invoice)).toBe(true);
    });

    it('WHEN overrides are supplied THEN applies them over the sampled values', (): void => {
      const fx = fixtures<TestComponents>(spec);

      const invoice = fx('invoice', { amount_due: 100 });

      expect(invoice.amount_due).toBe(100);
      expect(validate(invoice)).toBe(true);
    });

    it('WHEN the schema name is unknown THEN throws an error', (): void => {
      const fx = fixtures(spec);

      expect((): unknown => fx('nope')).toThrow('schema not found: nope');
    });

    it('WHEN the schema name is misspelled THEN suggests the schema that exists', (): void => {
      const fx = fixtures(spec);

      expect((): unknown => fx('invoic')).toThrow(expect.objectContaining({ fix: 'did you mean invoice?' }));
    });
  });

  describe('GIVEN a specification without components', (): void => {
    it('WHEN sampling a schema THEN reports that the schema is missing', (): void => {
      const fx = fixtures({});

      expect((): unknown => fx('invoice')).toThrow(expect.objectContaining({ fix: 'the document declares no schemas' }));
    });
  });

  describe('GIVEN a schema that samples to a primitive', (): void => {
    it('WHEN sampling a fixture THEN rejects the non-object result', (): void => {
      const schema: JSONSchema7 = { type: 'string' };
      const schemas = { scalar: schema };
      const components = { schemas };
      const spec: OpenApiSpec = { components };
      const fx = fixtures(spec);

      expect((): unknown => fx('scalar')).toThrow(Error);
    });
  });

  describe('GIVEN a schema whose optional property cycles back to an ancestor', (): void => {
    it('WHEN sampled THEN omits the looping property and stays schema-valid', (): void => {
      const id: JSONSchema7 = { type: 'string' };
      const amount: JSONSchema7 = { type: 'integer' };
      const errorType: JSONSchema7 = { type: 'string' };
      const paymentIntentRef: JSONSchema7 = { $ref: '#/components/schemas/payment_intent' };
      const apiErrorsRef: JSONSchema7 = { $ref: '#/components/schemas/api_errors' };
      const invoiceProperties = { id, payment_intent: paymentIntentRef };
      const invoice: JSONSchema7 = { type: 'object', required: ['id'], properties: invoiceProperties };
      const paymentIntentProperties = { id, amount, last_error: apiErrorsRef };
      const paymentIntent: JSONSchema7 = { type: 'object', required: ['id', 'amount'], properties: paymentIntentProperties };
      const apiErrorsProperties = { type: errorType, payment_intent: paymentIntentRef };
      const apiErrors: JSONSchema7 = { type: 'object', required: ['type'], properties: apiErrorsProperties };
      const schemas = { invoice, payment_intent: paymentIntent, api_errors: apiErrors };
      const components = { schemas };
      const spec: OpenApiSpec = { components };
      const validate = invoiceValidator(spec);

      const sampled = fixtures(spec)('invoice');
      const sampledPaymentIntent = isRecord(sampled) ? sampled['payment_intent'] : undefined;
      const lastError = isRecord(sampledPaymentIntent) ? sampledPaymentIntent['last_error'] : undefined;

      expect(isRecord(lastError)).toBe(true);
      expect(lastError).not.toHaveProperty('payment_intent');
      expect(validate(sampled)).toBe(true);
    });
  });
});
