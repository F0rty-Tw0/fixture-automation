import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { runSpecTask } from './spec-task.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture, studioSpec } from '../../test/utils/studio-spec.spec.util.ts';
import type { DiffTask, GenerateTask, MergeTask, SalvageMissingTask, ValidateMissingTask } from '../common/spec-compute.type.ts';

const PARTIAL_INVOICE = { id: 'in_1', amount_due: 1 };
const UNCOMPILABLE_NAME = { type: 'string', pattern: '(' };
const UNCOMPILABLE_PROPERTIES = { name: UNCOMPILABLE_NAME };
const UNCOMPILABLE_SCHEMA = { type: 'object', properties: UNCOMPILABLE_PROPERTIES };
const INVALID_REGEX = 'Invalid regular expression: /(/u: Unterminated group';

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

      const value = { valid: true, details: '', errors: [] };

      expect(outcome).toStrictEqual({ ok: true, value });
    });

    it('WHEN validate-missing runs on a breaking fill THEN succeeds with an invalid verdict naming the path', async (): Promise<void> => {
      const missing = await missingFixture('status');
      const fill = { status: 'paid' };
      const task: ValidateMissingTask = { name: 'validate-missing', missing, value: fill };

      const outcome = await runSpecTask(task);

      const params = { allowedValues: ['open'] };
      const error = { instancePath: '/status', keyword: 'enum', params, message: 'must be equal to one of the allowed values' };
      const errors = [error];
      const value = { valid: false, details: '/status: must be equal to one of the allowed values', errors };

      expect(outcome).toStrictEqual({ ok: true, value });
    });
  });

  describe('GIVEN a fill answer that breaks its missing projection', (): void => {
    it('WHEN salvage-missing runs THEN succeeds with the sampler value, its source and a note', async (): Promise<void> => {
      const missing = await missingFixture('status');
      const answer = { status: 'paid' };
      const task: SalvageMissingTask = { name: 'salvage-missing', missing, candidates: [answer], context: 'codex failed' };

      const outcome = await runSpecTask(task);

      const populated = { status: 'open' };
      const sources = { status: 'sampler' };
      const notes = ['codex failed; 1 value filled from the schema.'];
      const value = { populated, sources, notes };

      expect(outcome).toStrictEqual({ ok: true, value });
    });
  });

  describe('GIVEN a task that fails', (): void => {
    it('WHEN it throws a FixtureError THEN reports its message and fix', async (): Promise<void> => {
      const body = { endpointIds: ['GET /nope'], formats: ['json' as const], requiredOnly: true };
      const task: GenerateTask = { name: 'generate', spec, body };

      const outcome = await runSpecTask(task);

      expect(outcome).toMatchObject({
        ok: false,
        isFixtureError: true,
        message: 'unknown endpoint: GET /nope',
        fix: 'pick an endpoint from the list the spec was loaded with'
      });
    });

    it('WHEN it throws a plain Error THEN reports its message without a fix', async (): Promise<void> => {
      const missing = await missingFixture('status');
      const uncompilable: MissingFile = { ...missing, schema: UNCOMPILABLE_SCHEMA };
      const task: SalvageMissingTask = { name: 'salvage-missing', missing: uncompilable, candidates: [], context: 'codex failed' };

      const outcome = await runSpecTask(task);

      expect(outcome).toMatchObject({
        ok: false,
        isFixtureError: false,
        fix: undefined,
        message: INVALID_REGEX
      });
    });
  });
});
