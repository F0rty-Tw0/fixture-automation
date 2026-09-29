import type { AiFixtureOptions, AiMissingRequest, MissingValidator, MissingVerdict } from '@fixture-automation/openapi-ai-fixtures';

import { chunkedFill } from './ai-chunked-fill.ts';
import type { AiFillBody, MissingFile } from '../../contract/common/studio-api.type.ts';
import type { SpecCompute, ValidateMissingTask } from '../../spec-compute/common/spec-compute.type.ts';
import { computeInWorker } from '../../spec-compute/domain-logic/spec-compute.ts';
import type { SpecStore } from '../../specs/common/specs.type.ts';
import type { AiFillJob, ChunkedFillRun, FillRun } from '../common/ai.type.ts';
import { missingScenario } from '../utils/ai-prompt.util.ts';
import { endpointMissing } from '../utils/endpoint-missing.util.ts';

/** Validates the model's fill in a spec worker, so a backtracking `pattern` ends in a 422 instead of stalling the event loop. */
const workerValidator = (compute: SpecCompute, signal: AbortSignal): MissingValidator => {
  const validate = async (missing: MissingFile, value: unknown): Promise<MissingVerdict> => {
    const task: ValidateMissingTask = { name: 'validate-missing', missing, value };

    return computeInWorker(task, { ...compute, signal });
  };

  return validate;
};

/** The fill run, chunked when its prompt is too big for one answer; it releases its CLI slot however it ends. */
const fillJob = (run: FillRun, schemaName: string, body: AiFillBody): AiFillJob => {
  const { ai, compute, slots } = run;
  const scenario = missingScenario(body.scenario);

  const job: AiFillJob = async (signal, onProgress) => {
    const validate = workerValidator(compute, signal);
    const request: AiMissingRequest = { fixture: body.fixture, missing: body.missing, scenario, validate };
    let options: AiFixtureOptions = { tool: body.tool, signal, onProgress };

    if (body.model !== undefined) options = { ...options, model: body.model };

    try {
      // Compiles the projection before the paid CLI run; the verdict on `undefined` is irrelevant, only a compile error matters.
      await validate(body.missing, undefined);

      const enrich = ai.fill(options);
      const fill: ChunkedFillRun = { enrich, schemaName, request, signal, onProgress };

      return await chunkedFill(fill);
    } finally {
      slots.release();
    }
  };

  return job;
};

/** The fill job for the cached spec `specId`, holding one CLI slot until it ends; a 429 when every slot is taken. */
export const claimAiFillJob = (run: FillRun, cache: SpecStore, specId: string, body: AiFillBody): AiFillJob => {
  const { endpointId, missing } = body;
  const spec = cache.require(specId);
  const schemaName = endpointMissing(spec, endpointId, missing);
  const job = fillJob(run, schemaName, body);

  run.slots.claim();

  return job;
};
