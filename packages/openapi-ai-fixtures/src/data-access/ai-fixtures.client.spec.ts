import { pathToFileURL } from 'node:url';

import { fixtures, loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

import { aiFixtures } from './ai-fixtures.client.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';
import type { TestComponents, TestInvoice } from '../test/common/integration.type.ts';
import { integrationFile } from '../test/utils/integration-project.spec.util.ts';

describe('FEATURE: schema-validated AI fixture enrichment', (): void => {
  describe('GIVEN an existing typed invoice and an offline coding-tool process', (): void => {
    let spec: OpenApiSpec;
    let base: TestInvoice;
    let options: AiFixtureOptions;

    beforeEach(async (): Promise<void> => {
      const specFile = integrationFile('spec.json');
      const url = pathToFileURL(specFile);
      const executable = integrationFile('enricher.mjs');

      spec = await loadSpec(url);

      const getFixture = fixtures<TestComponents>(spec);

      base = getFixture('invoice');
      options = { tool: 'claude', executable, timeoutMs: 10000 };
    });

    it('WHEN enriching THEN returns the validated schema type with changed values', async (): Promise<void> => {
      const enrich = aiFixtures<TestComponents>(spec, options);
      const result = await enrich('invoice', { fixture: base, scenario: 'An open invoice for 4200 cents.' });

      expectTypeOf(result).toEqualTypeOf<TestInvoice>();
      expect(result).toStrictEqual({ id: 'in_ai', amount_due: 4200, status: 'open', memo: 'September subscription' });
    });

    it('WHEN enriching THEN leaves the caller fixture and specification unchanged', async (): Promise<void> => {
      const before = JSON.stringify({ base, spec });
      const enrich = aiFixtures<TestComponents>(spec, options);

      await enrich('invoice', { fixture: base, scenario: 'An open invoice for 4200 cents.' });

      const after = JSON.stringify({ base, spec });

      expect(after).toBe(before);
    });

    it.each(['invalid enum', 'invalid amount', 'missing required'])(
      'WHEN receiving %s THEN rejects a nonconforming generated fixture',
      async (scenario: string): Promise<void> => {
        const enrich = aiFixtures<TestComponents>(spec, options);

        await expect(enrich('invoice', { fixture: base, scenario })).rejects.toThrow(/violates schema/);
      }
    );

    it('WHEN the baseline violates constraints THEN permits AI to repair it', async (): Promise<void> => {
      const invalid: TestInvoice = { ...base, amount_due: -1 };
      const enrich = aiFixtures<TestComponents>(spec, options);
      const result = await enrich('invoice', { fixture: invalid, scenario: 'Correct the amount to 4200 cents.' });

      expect(result.amount_due).toBe(4200);
      expect(invalid.amount_due).toBe(-1);
    });

    it('WHEN the schema is missing THEN rejects before trying the executable', async (): Promise<void> => {
      const unavailable: AiFixtureOptions = { tool: 'claude', executable: integrationFile('missing.exe') };
      const enrich = aiFixtures({}, unavailable);

      await expect(enrich('invoice', { fixture: base, scenario: 'An open invoice.' })).rejects.toThrow(/schema/);
    });

    it('WHEN canceled before invocation THEN does not try the executable', async (): Promise<void> => {
      const controller = new AbortController();
      const canceled: AiFixtureOptions = { ...options, executable: integrationFile('missing.exe'), signal: controller.signal };
      const enrich = aiFixtures<TestComponents>(spec, canceled);

      controller.abort(new Error('generation canceled'));

      await expect(enrich('invoice', { fixture: base, scenario: 'An open invoice.' })).rejects.toThrow('generation canceled');
    });
  });
});
