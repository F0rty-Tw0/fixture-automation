import { vi } from 'vitest';

import type { StudioEngine } from '../../../shared/studio-engine/common/engine.type.ts';

export const studioEngineMock = (): StudioEngine => {
  const engine: StudioEngine = {
    loadSpec: vi.fn(),
    generate: vi.fn(),
    diff: vi.fn(),
    envelope: vi.fn(),
    merge: vi.fn(),
    aiPrompt: vi.fn(),
    cliModels: vi.fn(),
    cliTools: vi.fn(),
    cliFill: vi.fn()
  };

  return engine;
};
