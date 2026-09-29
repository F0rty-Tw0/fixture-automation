import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FillProgress } from './fill-progress.service.ts';
import { provideFixtureWorkbench } from './fixture-workbench.provider.ts';
import type { StudioEngine } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { MERGE_RESULT_STUB, MISSING_FILE_STUB } from '../../test/stubs/studio.stub.ts';
import { settle } from '../../test/utils/studio-http.spec.util.ts';
import type { AiFillContext, AiRunRequest } from '../common/ai-fill.type.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

const FIXTURE = { id: 'in_1' };
const CONTEXT: AiFillContext = {
  specId: 'spec-1',
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  missing: MISSING_FILE_STUB,
  scenario: undefined,
  tool: 'claude',
  model: undefined
};
const CLI_RUN: AiRunRequest = { provider: 'cli', context: CONTEXT, objectShape: undefined };

describe('FEATURE: fill progress', (): void => {
  let engine: StudioEngine;
  let progress: FillProgress;

  beforeEach((): void => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [provideFixtureWorkbench(), engineProvider] });
    progress = TestBed.inject(FillProgress);
  });

  it('GIVEN no run WHEN read THEN nothing runs, nothing is merged, and no CLI is asked', (): void => {
    TestBed.tick();

    expect(progress.isRunning()).toBe(false);
    expect(progress.mergeResult()).toBeUndefined();
    expect(engine.cliTools).not.toHaveBeenCalled();
  });

  it('GIVEN a run WHEN its answer is merged THEN exposes the merge', async (): Promise<void> => {
    vi.mocked(engine.cliFill).mockResolvedValue({ status: 'open' });
    vi.mocked(engine.merge).mockResolvedValue(MERGE_RESULT_STUB);

    TestBed.inject(AiFillStore).start(CLI_RUN);
    await settle();

    expect(progress.mergeResult()).toStrictEqual(MERGE_RESULT_STUB);
  });
});
