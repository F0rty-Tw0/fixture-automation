import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type {
  AiFillResultEvent,
  BrokenValue,
  DiffBody,
  DiffResult,
  FillSource,
  MergeResult
} from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FixHighlights } from './fix-highlights.service.ts';
import { provideFixtureWorkbench } from './fixture-workbench.provider.ts';
import type { LineHighlight } from '../../shared/document-view/common/document-view.type.ts';
import type { StudioEngine } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { DIFF_RESULT_STUB, FILL_RESULT_STUB, MERGE_RESULT_STUB, MISSING_FILE_STUB } from '../../test/stubs/studio.stub.ts';
import { settle } from '../../test/utils/studio-http.spec.util.ts';
import type { AiFillContext, AiRunRequest } from '../common/ai-fill.type.ts';
import type { DiffRequest, ExistingFixture } from '../common/comparison.type.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

const BROKEN_ID: BrokenValue = { path: 'id', value: 'in_1', reason: 'must match pattern' };
const BROKEN_DIFF: DiffResult = { ...DIFF_RESULT_STUB, broken: [BROKEN_ID] };
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
/** The user named a `data` envelope (with stray spaces) that the fixture does not have; the API then checks the root. */
const ABSENT_ENVELOPE_BODY: DiffBody = { ...COMPARED_BODY, objectShape: ' data ' };
const ABSENT_ENVELOPE: DiffRequest = { specId: 'spec-1', body: ABSENT_ENVELOPE_BODY };
const SALVAGED: AiFillResultEvent = { ...FILL_RESULT_STUB, sources: SAMPLED_STATUS };
const INVALID_MERGE: MergeResult = { ...MERGE_RESULT_STUB, valid: false, errors: ['/status: must be one of draft, open'] };

const lineOf = (highlights: LineHighlight[]): string[] => {
  return highlights.map((highlight) => `${highlight.from}:${highlight.origin}:${highlight.outcome}`);
};

describe('FEATURE: fix highlights', (): void => {
  let engine: StudioEngine;
  let highlights: FixHighlights;

  /** Reads `invoice.json` and compares it; the engine answers with `result`. */
  const compareWith = async (result: DiffResult, request: DiffRequest = COMPARED): Promise<void> => {
    const comparison = TestBed.inject(ComparisonStore);

    vi.mocked(engine.diff).mockResolvedValue(result);
    comparison.setExisting(EXISTING);
    comparison.compare(request);
    await settle();
  };

  /** Starts a CLI fill of the compared fixture and waits for it and its merge to settle. */
  const runFill = async (): Promise<void> => {
    TestBed.inject(AiFillStore).start({ ...CLI_RUN });
    await settle();
  };

  beforeEach((): void => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [provideFixtureWorkbench(), engineProvider] });
    highlights = TestBed.inject(FixHighlights);
  });

  it('GIVEN no compare WHEN read THEN highlights nothing', (): void => {
    expect(highlights.existing()).toStrictEqual([]);
    expect(highlights.complete()).toStrictEqual([]);
    expect(highlights.merged()).toStrictEqual([]);
  });

  describe('GIVEN a compare that found a broken value it keeps', (): void => {
    beforeEach(async (): Promise<void> => {
      await compareWith(BROKEN_DIFF);
    });

    it('WHEN the existing fixture is read THEN marks the broken value', (): void => {
      expect(lineOf(highlights.existing())).toStrictEqual(['2:broken:broken']);
    });

    it('WHEN the complete fixture is read THEN marks the sampler fill and the value left broken', (): void => {
      expect(lineOf(highlights.complete())).toStrictEqual(['3:missing:sampler', '2:broken:unfilled']);
    });
  });

  describe('GIVEN a merged fill', (): void => {
    beforeEach(async (): Promise<void> => {
      await compareWith(DIFF_RESULT_STUB);
    });

    it('WHEN the answer names no sources THEN marks each fill as the model’s', async (): Promise<void> => {
      vi.mocked(engine.cliFill).mockResolvedValue(FILL_RESULT_STUB);
      vi.mocked(engine.merge).mockResolvedValue(MERGE_RESULT_STUB);

      await runFill();

      expect(lineOf(highlights.merged())).toStrictEqual(['3:missing:ai']);
    });

    it('WHEN the merge is invalid THEN marks the failing value as still broken after its source', async (): Promise<void> => {
      vi.mocked(engine.cliFill).mockResolvedValue(SALVAGED);
      vi.mocked(engine.merge).mockResolvedValue(INVALID_MERGE);

      await runFill();

      expect(lineOf(highlights.merged())).toStrictEqual(['3:missing:sampler', '3:missing:unfilled']);
    });

    it('WHEN a re-run answers but its merge fails THEN drops the earlier merge and its highlights', async (): Promise<void> => {
      vi.mocked(engine.cliFill).mockResolvedValueOnce(SALVAGED).mockResolvedValueOnce(FILL_RESULT_STUB);
      vi.mocked(engine.merge).mockResolvedValueOnce(MERGE_RESULT_STUB).mockRejectedValueOnce(new Error('merge failed'));
      await runFill();

      await runFill();

      expect(highlights.merged()).toStrictEqual([]);
    });
  });

  it('GIVEN an envelope the fixture lacks WHEN the merge is invalid THEN marks the error at the root', async (): Promise<void> => {
    await compareWith(DIFF_RESULT_STUB, ABSENT_ENVELOPE);
    vi.mocked(engine.cliFill).mockResolvedValue(FILL_RESULT_STUB);
    vi.mocked(engine.merge).mockResolvedValue(INVALID_MERGE);

    await runFill();

    expect(lineOf(highlights.merged())).toStrictEqual(['3:missing:ai', '3:missing:unfilled']);
  });
});
