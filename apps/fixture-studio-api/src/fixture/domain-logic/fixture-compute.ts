import type {
  DiffBody,
  DiffResult,
  EnvelopeBody,
  EnvelopeResult,
  MergeBody,
  MergeResult
} from '../../contract/common/studio-api.type.ts';
import type { DiffTask, EnvelopeTask, MergeTask, SpecComputeOptions } from '../../spec-compute/common/spec-compute.type.ts';
import { computeInWorker } from '../../spec-compute/domain-logic/spec-compute.ts';
import type { SpecStore } from '../../specs/common/specs.type.ts';
import { endpointSchemaName } from '../../specs/utils/endpoint-schema.util.ts';

/** What `body.fixture` lacks against the endpoint's schema of the cached spec `specId`, computed in a spec worker. */
export const diffInWorker = async (
  cache: SpecStore,
  specId: string,
  body: DiffBody,
  compute: SpecComputeOptions
): Promise<DiffResult> => {
  const spec = cache.require(specId);
  const schemaName = endpointSchemaName(spec, body.endpointId);
  const task: DiffTask = { name: 'diff', spec, schemaName, body };

  return computeInWorker(task, compute);
};

/** The property of `body.fixture` most likely to hold the payload, computed in a spec worker. */
export const envelopeInWorker = async (
  cache: SpecStore,
  specId: string,
  body: EnvelopeBody,
  compute: SpecComputeOptions
): Promise<EnvelopeResult> => {
  const spec = cache.require(specId);
  const schemaName = endpointSchemaName(spec, body.endpointId);
  const task: EnvelopeTask = { name: 'envelope', spec, schemaName, body };

  return computeInWorker(task, compute);
};

/** `body.fixture` filled from `body.populated` and validated, computed in a spec worker. */
export const mergeInWorker = async (
  cache: SpecStore,
  specId: string,
  body: MergeBody,
  compute: SpecComputeOptions
): Promise<MergeResult> => {
  const spec = cache.require(specId);
  const schemaName = endpointSchemaName(spec, body.endpointId);
  const task: MergeTask = { name: 'merge', spec, schemaName, body };

  return computeInWorker(task, compute);
};
