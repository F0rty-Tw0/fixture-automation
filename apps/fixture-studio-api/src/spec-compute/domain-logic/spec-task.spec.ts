import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { runSpecTask } from './spec-task.ts';
import { openApiDocument } from '../../specs/utils/openapi-document.util.ts';
import { missingFixture, studioSpec } from '../../test/utils/studio-spec.spec.util.ts';
import type { DiffTask, GenerateTask, MergeTask, ValidateMissingTask } from '../common/spec-compute.type.ts';

const PARTIAL_INVOICE = { id: 'in_1', amount_due: 1 };

describe('FEATURE: spec task', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN each task name', (): void => {
    it('WHEN generate runs THEN succeeds with the generated fixtures', async (): Promise<void> => {
      const body = { endpointIds: ['GET /v1/invoices/{id}'], formats: ['json' as const], requiredOnly: true };
      const task: GenerateTask = { name: 'generate', spec, body };

      const outcome = await runSpecTask(task);

      expect(outcome).toMatchObject({ ok: true });
      expect(JSON.stringify(outcome)).toContain('in_123');
    });

    it('WHEN diff runs THEN succeeds with the missing paths', async (): Promise<void> => {
      const body = { endpointId: 'x', fixture: PARTIAL_INVOICE, requiredOnly: true };
      const task: DiffTask = { name: 'diff', spec, schemaName: 'invoice', body };

      const outcome = await runSpecTask(task);

      const value = { missingPaths: ['status'] };

      expect(outcome).toMatchObject({ ok: true, value });
    });

    it('WHEN merge runs THEN succeeds with the merge result', async (): Promise<void> => {
      const populated = { status: 'open' };
      const body = { endpointId: 'x', fixture: PARTIAL_INVOICE, populated };
      const task: MergeTask = { name: 'merge', spec, schemaName: 'invoice', body };

      const outcome = await runSpecTask(task);

      const value = { valid: true };

      expect(outcome).toMatchObject({ ok: true, value });
    });

    it('WHEN validate-missing runs on a fitting fill THEN succeeds with a valid verdict', async (): Promise<void> => {
      const missing = await missingFixture('status');
      const fill = { status: 'open' };
      const task: ValidateMissingTask = { name: 'validate-missing', missing, value: fill };

      const outcome = await runSpecTask(task);

      const value = { valid: true, details: '' };

      expect(outcome).toStrictEqual({ ok: true, value });
    });

    it('WHEN validate-missing runs on a breaking fill THEN succeeds with an invalid verdict naming the path', async (): Promise<void> => {
      const missing = await missingFixture('status');
      const fill = { status: 'paid' };
      const task: ValidateMissingTask = { name: 'validate-missing', missing, value: fill };

      const outcome = await runSpecTask(task);

      const value = { valid: false, details: '/status: must be equal to one of the allowed values' };

      expect(outcome).toStrictEqual({ ok: true, value });
    });
  });

  describe('GIVEN a task that fails', (): void => {
    it('WHEN it throws a FixtureError THEN reports its message and fix', async (): Promise<void> => {
      const body = { endpointId: 'x', fixture: PARTIAL_INVOICE, requiredOnly: true, objectShape: 'data' };
      const task: DiffTask = { name: 'diff', spec, schemaName: 'invoice', body };

      const outcome = await runSpecTask(task);

      expect(outcome).toMatchObject({
        ok: false,
        isFixtureError: true,
        message: 'fixture has no own property "data" for object-shape'
      });
    });

    it('WHEN it throws a plain Error THEN reports its message without a fix', async (): Promise<void> => {
      const bad = { type: ['string', 'null'] };
      const schemas = { bad };
      const components = { schemas };
      const upload = { openapi: '3.0.0', components };
      const invalidSpec = openApiDocument(upload);
      const body = { endpointId: 'x', fixture: 'a', populated: 'a' };
      const task: MergeTask = { name: 'merge', spec: invalidSpec, schemaName: 'bad', body };

      const outcome = await runSpecTask(task);

      expect(outcome).toMatchObject({
        ok: false,
        isFixtureError: false,
        fix: undefined,
        message: 'OpenAPI 3.0 schema type must be a string'
      });
    });
  });
});
