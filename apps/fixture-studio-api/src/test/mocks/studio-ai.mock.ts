import { vi } from 'vitest';

import type { StudioAi } from '../../ai/common/ai.type.ts';

/** Fresh spies for every AI entry point of a real (not mocked) CLI setup; each case sets their behavior. */
export const studioAiMock = (): StudioAi => {
  const ai: StudioAi = {
    fill: vi.fn<StudioAi['fill']>(),
    discover: vi.fn<StudioAi['discover']>(),
    detect: vi.fn<StudioAi['detect']>(),
    isMock: false
  };

  return ai;
};
