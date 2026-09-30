import { once } from 'node:events';
import { Worker } from 'node:worker_threads';

import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { computeInWorker } from './spec-compute.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { openApiDocument } from '../../specs/utils/openapi-document.util.ts';
import { backtrackingDocument, backtrackingMissing, fanOutDocument } from '../../test/utils/hostile-spec.spec.util.ts';
import { missingFixture, studioSpec } from '../../test/utils/studio-spec.spec.util.ts';
import type {
  GenerateTask,
  MergeTask,
  SalvageMissingTask,
  SpecComputeOptions,
  ValidateMissingTask
} from '../common/spec-compute.type.ts';
import { SpecWorkers } from '../data-access/spec-workers.store.ts';

const TIMEOUT_MS = 3_000;
const TOO_EXPENSIVE = 'spec too expensive to sample/validate';
const PARTIAL_INVOICE = { id: 'in_1', amount_due: 1 };
const BACKTRACKING_NAME = `${'a'.repeat(34)}!`;
const UNCOMPILABLE_NAME = { type: 'string', pattern: '(' };
const UNCOMPILABLE_PROPERTIES = { name: UNCOMPILABLE_NAME };
const UNCOMPILABLE_SCHEMA = { type: 'object', properties: UNCOMPILABLE_PROPERTIES };
const INVALID_REGEX = 'Invalid regular expression: /(/u: Unterminated group';

const workers = new SpecWorkers();

const computeOptions = (signal = new AbortController().signal): SpecComputeOptions => {
  const options: SpecComputeOptions = { workers, timeoutMs: TIMEOUT_MS, signal };

  return options;
};

describe('FEATURE: spec compute worker', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  afterAll(async (): Promise<void> => {
    await workers.close();
  });

  describe('GIVEN an ordinary spec', (): void => {
    it('WHEN a merge runs in the worker THEN resolves with the merge result', async (): Promise<void> => {
      const populated = { status: 'open' };
      const body = { endpointId: 'GET /v1/invoices/{id}', fixture: PARTIAL_INVOICE, populated };
      const task: MergeTask = { name: 'merge', spec, schemaName: 'invoice', body };

      const result = await computeInWorker(task, computeOptions());

      expect(result).toMatchObject({ valid: true, filled: ['status'] });
    });

    it('WHEN a salvage runs in the worker THEN resolves with the salvaged fill', async (): Promise<void> => {
      const missing = await missingFixture('status');
      const task: SalvageMissingTask = { name: 'salvage-missing', missing, candidates: [], context: 'codex failed' };

      const result = await computeInWorker(task, computeOptions());

      const populated = { status: 'open' };
      const sources = { status: 'sampler' };
      const notes = ['codex failed; 1 value filled from the schema.'];

      expect(result).toStrictEqual({ populated, sources, notes });
    });

    it('WHEN the task throws a FixtureError THEN rejects with it and its fix', async (): Promise<void> => {
      const body = { endpointIds: ['GET /nope'], formats: ['json' as const], requiredOnly: false };
      const task: GenerateTask = { name: 'generate', spec, body };

      const computation = computeInWorker(task, computeOptions());

      await expect(computation).rejects.toThrow(
        expect.objectContaining({
          name: 'FixtureError',
          message: 'unknown endpoint: GET /nope',
          fix: 'pick an endpoint from the list the spec was loaded with'
        })
      );
    });

    it('WHEN the task throws another error THEN rejects with a plain Error of its message', async (): Promise<void> => {
      const missing = await missingFixture('status');
      const uncompilable: MissingFile = { ...missing, schema: UNCOMPILABLE_SCHEMA };
      const task: SalvageMissingTask = { name: 'salvage-missing', missing: uncompilable, candidates: [], context: 'codex failed' };

      const computation = computeInWorker(task, computeOptions());

      await expect(computation).rejects.toThrow(expect.objectContaining({ name: 'Error', message: INVALID_REGEX }));
    });
  });

  describe('GIVEN a spec whose schema graph fans out', (): void => {
    it('WHEN it is sampled THEN rejects with a 422 within the time budget', async (): Promise<void> => {
      const fanOut = openApiDocument(fanOutDocument(8, 10));
      const body = { endpointIds: ['GET /fan'], formats: ['json' as const], requiredOnly: false };
      const task: GenerateTask = { name: 'generate', spec: fanOut, body };
      const started = Date.now();

      const computation = computeInWorker(task, computeOptions());

      await expect(computation).rejects.toThrow(expect.objectContaining({ statusCode: 422, message: TOO_EXPENSIVE }));
      expect(Date.now() - started).toBeLessThan(TIMEOUT_MS + 2_000);
    });
  });

  describe('GIVEN a schema pattern that backtracks catastrophically', (): void => {
    it('WHEN a merge validates against it THEN rejects with a 422', async (): Promise<void> => {
      const backtracking = openApiDocument(backtrackingDocument());
      const populated = { name: BACKTRACKING_NAME };
      const body = { endpointId: 'GET /named', fixture: {}, populated };
      const task: MergeTask = { name: 'merge', spec: backtracking, schemaName: 'named', body };

      const computation = computeInWorker(task, computeOptions());

      await expect(computation).rejects.toThrow(expect.objectContaining({ statusCode: 422 }));
    });

    it('WHEN an AI fill is validated against its missing projection THEN rejects with a 422 within the time budget', async (): Promise<void> => {
      const value = { name: BACKTRACKING_NAME };
      const task: ValidateMissingTask = { name: 'validate-missing', missing: backtrackingMissing(), value };
      const started = Date.now();

      const computation = computeInWorker(task, computeOptions());

      await expect(computation).rejects.toThrow(expect.objectContaining({ statusCode: 422, message: TOO_EXPENSIVE }));
      expect(Date.now() - started).toBeLessThan(TIMEOUT_MS + 2_000);
    });
  });

  describe('GIVEN a time budget the timer cannot take', (): void => {
    it('WHEN a task runs THEN rejects and still terminates the worker it took', async (): Promise<void> => {
      const idle = new Worker("setInterval(() => {}, 1000); require('node:worker_threads').parentPort.postMessage('ready');", {
        eval: true
      });
      const exited = once(idle, 'exit');
      const idleWorkers = { take: async (): Promise<Worker> => Promise.resolve(idle) };
      const body = { endpointIds: ['GET /v1/invoices/{id}'], formats: ['json' as const], requiredOnly: false };
      const task: GenerateTask = { name: 'generate', spec, body };
      const defaults = computeOptions();
      const options: SpecComputeOptions = { ...defaults, workers: idleWorkers, timeoutMs: Number.NaN };

      const computation = computeInWorker(task, options);

      await expect(computation).rejects.toThrow(RangeError);
      await expect(exited).resolves.toBeDefined();
    });
  });

  describe('GIVEN a worker file from another version of the protocol', (): void => {
    it('WHEN it answers with something other than an outcome THEN rejects with a 500 telling to restart', async (): Promise<void> => {
      const source =
        "require('node:worker_threads').parentPort.once('message', (task) => require('node:worker_threads').parentPort.postMessage('ready'));";
      const staleWorkers = { take: async (): Promise<Worker> => Promise.resolve(new Worker(source, { eval: true })) };
      const body = { endpointIds: ['GET /v1/invoices/{id}'], formats: ['json' as const], requiredOnly: false };
      const task: GenerateTask = { name: 'generate', spec, body };
      const defaults = computeOptions();
      const options: SpecComputeOptions = { ...defaults, workers: staleWorkers };

      const computation = computeInWorker(task, options);

      await expect(computation).rejects.toThrow(
        expect.objectContaining({ statusCode: 500, message: "the spec worker answered with an unexpected message: string 'ready'" })
      );
    });
  });

  describe('GIVEN a client that disconnects', (): void => {
    it('WHEN the signal aborts mid-task THEN rejects with its reason before the time budget', async (): Promise<void> => {
      const controller = new AbortController();
      const fanOut = openApiDocument(fanOutDocument(8, 10));
      const body = { endpointIds: ['GET /fan'], formats: ['json' as const], requiredOnly: false };
      const task: GenerateTask = { name: 'generate', spec: fanOut, body };
      const started = Date.now();
      const computation = computeInWorker(task, computeOptions(controller.signal));

      setTimeout((): void => controller.abort(new Error('client gone')), 200);

      await expect(computation).rejects.toThrow('client gone');
      expect(Date.now() - started).toBeLessThan(TIMEOUT_MS);
    });

    it('WHEN the signal is already aborted THEN rejects without starting a worker', async (): Promise<void> => {
      const controller = new AbortController();
      const body = { endpointIds: ['GET /v1/invoices/{id}'], formats: ['json' as const], requiredOnly: false };
      const task: GenerateTask = { name: 'generate', spec, body };

      controller.abort(new Error('gone already'));

      await expect(computeInWorker(task, computeOptions(controller.signal))).rejects.toThrow('gone already');
    });
  });
});
