import type { AiFillBody } from '@fixture-automation/fixture-studio-api/contract';

import { ON_DEVICE_PROMPT_BYTE_LIMIT } from '../common/ai-fill.const.ts';
import type { AiAvailability, AiFillContext, AiProviderId, DiffPromptSize, OnDeviceState } from '../common/ai-fill.type.ts';

/** On-device AI is usable unless Chrome says it can't run here; a download starts on first use. */
const isUsableAvailability = (availability: AiAvailability | undefined): boolean => {
  return availability !== undefined && availability !== 'unavailable';
};

/** The on-device provider only when the user opted in and Chrome can run it; the local CLI otherwise. */
export const chooseAiProvider = (isOptedIn: boolean, availability: AiAvailability | undefined): AiProviderId => {
  const isUsable = isUsableAvailability(availability);

  return isOptedIn && isUsable ? 'chrome' : 'cli';
};

/** Whether a diff's trimmed prompt is small enough to offer the on-device model. */
const fitsOnDevice = (promptBytes: number): boolean => promptBytes <= ON_DEVICE_PROMPT_BYTE_LIMIT;

/**
 * Whether the on-device model is offered: a settled diff decides by its size, a diff on its way keeps the earlier
 * answer so a re-compare doesn't flash the opt-in, and with neither the model is offered.
 */
export const isOfferedOnDevice = (size: DiffPromptSize, wasOffered: boolean | undefined): boolean => {
  if (size === 'loading') return wasOffered ?? true;

  if (size === undefined) return true;

  return fitsOnDevice(size);
};

/** The on-device model's state: a download the user started wins over what Chrome last reported. */
export const onDeviceState = (availability: AiAvailability | undefined, isDownloading: boolean): OnDeviceState => {
  if (isDownloading) return 'downloading';

  switch (availability) {
    case undefined:
      return 'checking';
    case 'available':
      return 'ready';
    case 'downloadable':
      return 'needs-download';
    case 'downloading':
      return 'downloading';
    case 'unavailable':
      return 'unavailable';
  }
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
