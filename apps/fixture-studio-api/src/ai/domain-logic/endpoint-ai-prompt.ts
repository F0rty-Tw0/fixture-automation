import type { AiPromptBody, AiPromptResult } from '../../contract/common/studio-api.type.ts';
import type { SpecStore } from '../../specs/common/specs.type.ts';
import { aiPrompt } from '../utils/ai-prompt.util.ts';
import { endpointMissing } from '../utils/endpoint-missing.util.ts';

/** The on-device prompt for `body`, once its `missing` matches the endpoint's schema in the cached spec `specId`. */
export const endpointAiPrompt = (cache: SpecStore, specId: string, body: AiPromptBody): AiPromptResult => {
  const { endpointId, fixture, missing, paths, scenario } = body;
  const spec = cache.require(specId);

  endpointMissing(spec, endpointId, missing);

  return aiPrompt(fixture, missing, scenario, paths);
};
