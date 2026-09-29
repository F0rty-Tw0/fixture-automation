import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AiModelsResult } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CliModelsStore } from './cli-models.store.ts';
import type { StudioEngine } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { rejectionOf } from '../../test/utils/promise.spec.util.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

const MODELS: AiModelsResult = { models: ['sonnet'], source: 'claude' };

describe('FEATURE: CLI model discovery', (): void => {
  let engine: StudioEngine;
  let store: CliModelsStore;

  beforeEach((): void => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [engineProvider] });
    store = TestBed.inject(CliModelsStore);
  });

  it('GIVEN several tabs WHEN they ask for one tool THEN discovers it once and shares the answer', async (): Promise<void> => {
    vi.mocked(engine.cliModels).mockResolvedValue(MODELS);

    const answers = await Promise.all([store.modelsOf('claude'), store.modelsOf('claude')]);

    expect(answers).toStrictEqual([MODELS, MODELS]);
    expect(engine.cliModels).toHaveBeenCalledTimes(1);
  });

  it('GIVEN two tools WHEN asked THEN discovers each one', async (): Promise<void> => {
    vi.mocked(engine.cliModels).mockResolvedValue(MODELS);

    await store.modelsOf('claude');
    await store.modelsOf('codex');

    expect(engine.cliModels).toHaveBeenCalledTimes(2);
  });

  it('GIVEN a failed discovery WHEN asked again THEN tries again', async (): Promise<void> => {
    vi.mocked(engine.cliModels).mockRejectedValueOnce(new Error('too many AI CLI runs at once')).mockResolvedValue(MODELS);

    await rejectionOf(store.modelsOf('claude'));

    await expect(store.modelsOf('claude')).resolves.toStrictEqual(MODELS);
  });
});
