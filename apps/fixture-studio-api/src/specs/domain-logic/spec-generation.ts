import type { GenerateBody, GenerateResult } from '../../contract/common/studio-api.type.ts';
import type { GenerateTask, SpecComputeOptions } from '../../spec-compute/common/spec-compute.type.ts';
import { computeInWorker } from '../../spec-compute/domain-logic/spec-compute.ts';
import type { SpecStore } from '../common/specs.type.ts';

/** Samples fixtures from the cached spec `specId` in a spec worker. */
export const generateInWorker = async (
  cache: SpecStore,
  specId: string,
  body: GenerateBody,
  compute: SpecComputeOptions
): Promise<GenerateResult> => {
  const spec = cache.require(specId);
  const task: GenerateTask = { name: 'generate', spec, body };

  return computeInWorker(task, compute);
};
