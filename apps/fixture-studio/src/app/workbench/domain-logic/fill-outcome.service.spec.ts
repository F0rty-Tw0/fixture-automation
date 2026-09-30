import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AiFillResultEvent, DiffBody, DiffResult, FillSource } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FillOutcome } from './fill-outcome.service.ts';
import { provideFixtureWorkbench } from './fixture-workbench.provider.ts';
import type { StudioEngine } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { DIFF_RESULT_STUB, FILL_RESULT_STUB, MERGE_RESULT_STUB, MISSING_FILE_STUB } from '../../test/stubs/studio.stub.ts';
import { settle } from '../../test/utils/studio-http.spec.util.ts';
import type { AiFillContext, AiRunRequest, FilledPath } from '../common/ai-fill.type.ts';
import type { DiffRequest, ExistingFixture } from '../common/comparison.type.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

const FIXTURE = { id: 'in_1' };
const EXISTING: ExistingFixture = { name: 'invoice.json', value: FIXTURE, pretty: '{\n  "id": "in_1"\n}\n' };
const COMPARED_BODY: DiffBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, requiredOnly: false };
const COMPARED: DiffRequest = { specId: 'spec-1', body: COMPARED_BODY };
const CONTEXT: AiFillContext = {
  specId: 'spec-1',
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  missing: MISSING_FILE_STUB,
  complete: undefined,
  scenario: undefined,
  tool: 'claude',
  model: undefined
};
const CLI_RUN: AiRunRequest = { provider: 'cli', context: CONTEXT, objectShape: undefined };
const SAMPLED_STATUS: Record<string, FillSource> = { status: 'sampler' };
const SALVAGED: AiFillResultEvent = { ...FILL_RESULT_STUB, sources: SAMPLED_STATUS, notes: ['The model left status out.'] };
const CLI_FAILURE = new Error('claude exited with code 1.');

/** A CLI that never answers: the run stays open until it is cancelled. */
const noAnswer = (): void => undefined;

describe('FEATURE: fill outcome', (): void => {
  let engine: StudioEngine;
  let outcome: FillOutcome;

  /** Reads `invoice.json` and compares it; the engine answers with `result`. */
  const compareWith = async (result: DiffResult): Promise<void> => {
    const comparison = TestBed.inject(ComparisonStore);

    vi.mocked(engine.diff).mockResolvedValue(result);
    comparison.setExisting(EXISTING);
    comparison.compare(COMPARED);
    await settle();
  };

  /** Starts a CLI fill of the compared fixture and waits for it and its merge to settle. */
  const runFill = async (): Promise<void> => {
    TestBed.inject(AiFillStore).start({ ...CLI_RUN });
    await settle();
  };

  beforeEach(async (): Promise<void> => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [provideFixtureWorkbench(), engineProvider] });
    outcome = TestBed.inject(FillOutcome);
    await compareWith(DIFF_RESULT_STUB);
  });

  it('GIVEN no fill yet WHEN read THEN has no notes, no filled paths and no fallback', (): void => {
    expect(outcome.notes()).toStrictEqual([]);
    expect(outcome.filledPaths()).toStrictEqual([]);
    expect(outcome.fallbackJson()).toBeUndefined();
  });

  describe('GIVEN an answer without sources', (): void => {
    beforeEach(async (): Promise<void> => {
      vi.mocked(engine.cliFill).mockResolvedValue(FILL_RESULT_STUB);
      vi.mocked(engine.merge).mockResolvedValue(MERGE_RESULT_STUB);
      await runFill();
    });

    it('WHEN read THEN credits AI for every filled path', (): void => {
      const expected: FilledPath[] = [{ path: 'status', source: 'ai' }];

      expect(outcome.filledPaths()).toStrictEqual(expected);
    });

    it('WHEN read THEN has no notes', (): void => {
      expect(outcome.notes()).toStrictEqual([]);
    });
  });

  it('GIVEN a salvaged answer WHEN read THEN lists each source and the notes', async (): Promise<void> => {
    vi.mocked(engine.cliFill).mockResolvedValue(SALVAGED);
    vi.mocked(engine.merge).mockResolvedValue(MERGE_RESULT_STUB);

    await runFill();

    expect(outcome.filledPaths()).toStrictEqual([{ path: 'status', source: 'sampler' }]);
    expect(outcome.notes()).toStrictEqual(['The model left status out.']);
  });

  describe('GIVEN a fill that fails', (): void => {
    it('WHEN nothing was merged before THEN offers the schema-complete fixture', async (): Promise<void> => {
      vi.mocked(engine.cliFill).mockRejectedValue(CLI_FAILURE);

      await runFill();

      expect(outcome.fallbackJson()).toBe(DIFF_RESULT_STUB.completeJson);
    });

    it('WHEN an earlier fill was merged THEN keeps showing that merge instead', async (): Promise<void> => {
      vi.mocked(engine.cliFill).mockResolvedValueOnce(FILL_RESULT_STUB).mockRejectedValue(CLI_FAILURE);
      vi.mocked(engine.merge).mockResolvedValue(MERGE_RESULT_STUB);
      await runFill();

      await runFill();

      expect(outcome.fallbackJson()).toBeUndefined();
    });
  });

  it('GIVEN a merge that fails WHEN read THEN offers the schema-complete fixture', async (): Promise<void> => {
    vi.mocked(engine.cliFill).mockResolvedValue(FILL_RESULT_STUB);
    vi.mocked(engine.merge).mockRejectedValue(new Error('merge failed'));

    await runFill();

    expect(outcome.fallbackJson()).toBe(DIFF_RESULT_STUB.completeJson);
  });

  describe('GIVEN a salvaged fill that merged, then a re-run whose merge fails', (): void => {
    beforeEach(async (): Promise<void> => {
      vi.mocked(engine.cliFill).mockResolvedValueOnce(SALVAGED).mockResolvedValueOnce(FILL_RESULT_STUB);
      vi.mocked(engine.merge).mockResolvedValueOnce(MERGE_RESULT_STUB).mockRejectedValueOnce(new Error('merge failed'));
      await runFill();

      await runFill();
    });

    it('WHEN read THEN the sources still belong to the merge on screen', (): void => {
      expect(outcome.filledPaths()).toStrictEqual([{ path: 'status', source: 'sampler' }]);
    });

    it('WHEN read THEN the notes and filled values still belong to the merge on screen', (): void => {
      expect(outcome.notes()).toStrictEqual(['The model left status out.']);
      expect(outcome.filledJson()).toBe('{\n  "status": "open"\n}\n');
    });
  });

  it('GIVEN an answer whose merge fails and no earlier merge WHEN read THEN still shows that answer', async (): Promise<void> => {
    vi.mocked(engine.cliFill).mockResolvedValue(SALVAGED);
    vi.mocked(engine.merge).mockRejectedValue(new Error('merge failed'));

    await runFill();

    expect(outcome.filledJson()).toBe('{\n  "status": "open"\n}\n');
    expect(outcome.notes()).toStrictEqual(['The model left status out.']);
  });

  describe('GIVEN a fill cancelled before any merge', (): void => {
    beforeEach((): void => {
      vi.mocked(engine.cliFill).mockReturnValue(new Promise<AiFillResultEvent>(noAnswer));
      TestBed.inject(AiFillStore).start({ ...CLI_RUN });
      TestBed.tick();
      TestBed.inject(AiFillStore).cancel();
      TestBed.tick();
    });

    it('WHEN read THEN offers the schema-complete fixture', (): void => {
      expect(outcome.fallbackJson()).toBe(DIFF_RESULT_STUB.completeJson);
    });

    it('WHEN the fill starts again THEN stops offering it while the new run works', (): void => {
      TestBed.inject(AiFillStore).start({ ...CLI_RUN });
      TestBed.tick();

      expect(outcome.fallbackJson()).toBeUndefined();
    });
  });
});
