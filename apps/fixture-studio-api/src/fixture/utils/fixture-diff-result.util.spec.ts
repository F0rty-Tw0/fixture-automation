import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { fixtureDiffResult } from './fixture-diff-result.util.ts';
import { fixtureJson } from './fixture-merge.util.ts';
import { aiPrompt, promptBytes, trimmedPromptBytes } from '../../ai/utils/ai-prompt.util.ts';
import type { DiffBody } from '../../contract/common/studio-api.type.ts';
import { studioSpec } from '../../test/utils/studio-spec.spec.util.ts';
import { isInsertionOnly } from '../test/utils/text-diff.spec.util.ts';

const PARTIAL_INVOICE = { id: 'in_9', amount_due: 5 };
const CUSTOMER = { id: 'cus_9' };
const NESTED_INVOICE = { id: 'in_9', amount_due: 5, status: 'open', memo: 'm', customer: CUSTOMER };
const PLACEHOLDER_INVOICE = { id: 'in_9', amount_due: 0, status: 'open', memo: 'string' };
const PLACEHOLDER_BASELINE = { id: 'in_9', status: 'open' };
const REQUIRED_INVOICE = { id: 'in_9', amount_due: 5, status: 'open' };
const NOTES = Array.from({ length: 400 }, (_value: unknown, index: number): string => `note ${index}`);
const HISTORY = { notes: NOTES };
const INVOICE_WITH_HISTORY = { ...PARTIAL_INVOICE, history: HISTORY };

const diffBody = (fixture: unknown, requiredOnly: boolean, objectShape?: string, replacePlaceholders?: boolean): DiffBody => {
  const body: DiffBody = { endpointId: 'GET /v1/invoices/{id}', fixture, requiredOnly, replacePlaceholders };

  if (objectShape === undefined) return body;

  const shaped: DiffBody = { ...body, objectShape };

  return shaped;
};

describe('FEATURE: fixture diff result', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN an invoice missing optional and required fields', (): void => {
    it('WHEN diffed with every field THEN lists each missing path in missing and missingPaths', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(PARTIAL_INVOICE, false));

      expect(result.missing.paths).toStrictEqual(['status', 'memo', 'customer']);
      expect(result.missingPaths).toStrictEqual(result.missing.paths);
      expect(result.missing).toMatchObject({ schemaName: 'invoice', dialect: 'openapi-30' });
    });

    it('WHEN diffed with requiredOnly THEN lists and fills only the required field', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(PARTIAL_INVOICE, true));

      const complete: unknown = JSON.parse(result.completeJson);

      expect(result.missingPaths).toStrictEqual(['status']);
      expect(complete).toStrictEqual({ id: 'in_9', amount_due: 5, status: 'draft' });
    });

    it('WHEN completed THEN keeps the existing values first and in order', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(PARTIAL_INVOICE, false));

      const complete: unknown = JSON.parse(result.completeJson);

      expect(Object.keys(complete ?? {})).toStrictEqual(['id', 'amount_due', 'status', 'memo', 'customer']);
      expect(complete).toMatchObject(PARTIAL_INVOICE);
    });

    it('WHEN completed THEN the text only inserts characters into the original pretty JSON', (): void => {
      const before = fixtureJson(PARTIAL_INVOICE);

      const result = fixtureDiffResult(spec, 'invoice', diffBody(PARTIAL_INVOICE, false));

      expect(isInsertionOnly(before, result.completeJson)).toBe(true);
      expect(result.completeJson.length).toBeGreaterThan(before.length);
    });
  });

  describe('GIVEN an invoice with a large subtree off every missing path', (): void => {
    it('WHEN diffed THEN promptBytes is the byte length of the prompt trimmed to the missing paths', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(INVOICE_WITH_HISTORY, false));

      const trimmed = aiPrompt(result.baseline, result.missing, undefined, result.missingPaths);
      const expected = Buffer.byteLength(trimmed.prompt, 'utf8');

      expect(result.promptBytes).toBe(expected);
    });

    it('WHEN diffed THEN promptBytes is a fraction of the untrimmed baseline prompt', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(INVOICE_WITH_HISTORY, false));

      const untrimmed = promptBytes(result.baseline, result.missing, undefined);

      expect(result.promptBytes).toBeLessThan(untrimmed / 2);
    });
  });

  describe('GIVEN an invoice with every required field', (): void => {
    it('WHEN diffed with requiredOnly THEN nothing is missing and promptBytes is 0', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(REQUIRED_INVOICE, true));

      expect(result.missingPaths).toStrictEqual([]);
      expect(result.promptBytes).toBe(0);
    });
  });

  describe('GIVEN a nested object missing a referenced child', (): void => {
    it('WHEN diffed THEN the missing components carry the referenced schema and the text only inserts', (): void => {
      const before = fixtureJson(NESTED_INVOICE);

      const result = fixtureDiffResult(spec, 'invoice', diffBody(NESTED_INVOICE, false));

      expect(result.missingPaths).toStrictEqual(['customer.address']);
      expect(Object.keys(result.missing.components.schemas)).toStrictEqual(['address']);
      expect(isInsertionOnly(before, result.completeJson)).toBe(true);
    });
  });

  describe('GIVEN an invoice holding sampler placeholders', (): void => {
    it('WHEN diffed THEN lists them as replaced and missing, and answers the baseline without them', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(PLACEHOLDER_INVOICE, false));

      expect(result.replacedPaths).toStrictEqual(['amount_due', 'memo']);
      expect(result.missingPaths).toStrictEqual(['amount_due', 'memo', 'customer']);
      expect(result.baseline).toStrictEqual(PLACEHOLDER_BASELINE);
    });

    it('WHEN diffed THEN promptBytes sizes the baseline without them, not the fixture', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(PLACEHOLDER_INVOICE, false));

      const fromBaseline = trimmedPromptBytes(PLACEHOLDER_BASELINE, result.missing);
      const fromFixture = trimmedPromptBytes(PLACEHOLDER_INVOICE, result.missing);

      expect(result.promptBytes).toBe(fromBaseline);
      expect(result.promptBytes).not.toBe(fromFixture);
    });

    it('WHEN completed THEN each replaced key keeps its place from the original fixture', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(PLACEHOLDER_INVOICE, false));

      const complete: unknown = JSON.parse(result.completeJson);

      expect(Object.keys(complete ?? {})).toStrictEqual(['id', 'amount_due', 'status', 'memo', 'customer']);
    });

    it('WHEN diffed with replacePlaceholders false THEN nothing is replaced and the baseline is the fixture', (): void => {
      const result = fixtureDiffResult(spec, 'invoice', diffBody(PLACEHOLDER_INVOICE, false, undefined, false));

      const absent = ['customer'];

      expect(result.replacedPaths).toStrictEqual([]);
      expect(result.missingPaths).toStrictEqual(absent);
      expect(result.baseline).toStrictEqual(PLACEHOLDER_INVOICE);
    });
  });

  describe('GIVEN an existing value of the wrong JSON type', (): void => {
    it('WHEN completed THEN the sampler value replaces it, so the text is no longer insertion-only', (): void => {
      const fixture = { ...PARTIAL_INVOICE, amount_due: '5' };
      const before = fixtureJson(fixture);

      const result = fixtureDiffResult(spec, 'invoice', diffBody(fixture, true));

      expect(result.completeJson).toContain('"amount_due": 0');
      expect(isInsertionOnly(before, result.completeJson)).toBe(false);
    });
  });

  describe('GIVEN an object-shape envelope', (): void => {
    it('WHEN diffed THEN paths carry the envelope key and siblings stay untouched', (): void => {
      const fixture = { data: PARTIAL_INVOICE, meta: 1 };

      const result = fixtureDiffResult(spec, 'invoice', diffBody(fixture, true, ' data '));

      const complete: unknown = JSON.parse(result.completeJson);

      expect(result.missingPaths).toStrictEqual(['data.status']);
      const data = { id: 'in_9', amount_due: 5, status: 'draft' };

      expect(complete).toStrictEqual({ data, meta: 1 });
    });

    it('WHEN the envelope key is absent THEN fails with a fix before diffing', (): void => {
      const fixture = { other: PARTIAL_INVOICE };

      expect((): unknown => fixtureDiffResult(spec, 'invoice', diffBody(fixture, true, 'data'))).toThrow(
        'fixture has no own property "data" for object-shape'
      );
    });
  });
});
