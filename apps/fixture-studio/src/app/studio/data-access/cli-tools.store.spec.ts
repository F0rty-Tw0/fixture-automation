import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CliToolsStore } from './cli-tools.store.ts';
import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { StudioEngine } from '../common/engine.type.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';
import { CLI_TOOLS_RESULT_STUB } from '../test/stubs/studio.stub.ts';
import { rejectionOf } from '../test/utils/promise.spec.util.ts';

describe('FEATURE: CLI install check', (): void => {
  let engine: StudioEngine;
  let store: CliToolsStore;

  beforeEach((): void => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [engineProvider] });
    store = TestBed.inject(CliToolsStore);
  });

  it('GIVEN several tabs WHEN they ask THEN checks once and shares the answer', async (): Promise<void> => {
    vi.mocked(engine.cliTools).mockResolvedValue(CLI_TOOLS_RESULT_STUB);

    const answers = await Promise.all([store.tools(), store.tools()]);

    expect(answers).toStrictEqual([CLI_TOOLS_RESULT_STUB, CLI_TOOLS_RESULT_STUB]);
    expect(engine.cliTools).toHaveBeenCalledTimes(1);
  });

  it('GIVEN a failed check WHEN asked again THEN checks again', async (): Promise<void> => {
    vi.mocked(engine.cliTools).mockRejectedValueOnce(new Error('The Fixture Studio API did not answer.')).mockResolvedValue(CLI_TOOLS_RESULT_STUB);

    await rejectionOf(store.tools());

    await expect(store.tools()).resolves.toStrictEqual(CLI_TOOLS_RESULT_STUB);
  });
});
