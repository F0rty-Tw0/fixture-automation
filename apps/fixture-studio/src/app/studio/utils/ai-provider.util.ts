import type { AiFillBody } from '@fixture-automation/fixture-studio-api/contract';

import type { AiAvailability, AiFillContext, AiProviderId } from '../common/ai-fill.type.ts';

/** On-device AI is usable unless Chrome says it can't run here; a download starts on first use. */
const isUsableAvailability = (availability: AiAvailability | undefined): boolean => {
  return availability !== undefined && availability !== 'unavailable';
};

/** The on-device provider only when the user opted in and Chrome can run it; the local CLI otherwise. */
export const chooseAiProvider = (isOptedIn: boolean, availability: AiAvailability | undefined): AiProviderId => {
  const isUsable = isUsableAvailability(availability);

  return isOptedIn && isUsable ? 'chrome' : 'cli';
};

/** The local CLI provider's request: the fill context as the API's `ai-fill` body. */
export const cliFillBody = (context: AiFillContext): AiFillBody => {
  const body: AiFillBody = {
    endpointId: context.endpointId,
    fixture: context.fixture,
    missing: context.missing,
    tool: context.tool,
    model: context.model,
    scenario: context.scenario
  };

  return body;
};
