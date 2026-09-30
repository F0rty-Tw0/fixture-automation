import { AiFillRejectedError } from '@fixture-automation/openapi-ai-fixtures';
import type { AiFixtureProgress, AiMissingFactory, AiMissingRequest, MissingVerdict } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { chunkedFill } from './ai-chunked-fill.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture } from '../../test/utils/studio-spec.spec.util.ts';
import type { ChunkedFillRun, FillOutcome, MissingSalvager } from '../common/ai.type.ts';
import { missingSalvage } from '../utils/missing-salvage.util.ts';

const INVOICE = { id: 'in_9', amount_due: 5 };
const LARGE_INVOICE = { ...INVOICE, memo: 'm'.repeat(300 * 1024) };
const HUGE_INVOICE = { ...INVOICE, memo: 'm'.repeat(1100 * 1024) };
const STATUS_ANSWER = { status: 'draft' };
const CUSTOMER = { id: 'cus_1' };
const CUSTOMER_ANSWER = { customer: CUSTOMER };
const MERGED_ANSWER = { status: 'draft', customer: CUSTOMER };
const ALL_AI = { status: 'ai', customer: 'ai' };
const CHUNK_LINES = ['Chunk 1 of 2: 1 field…\n', 'Chunk 2 of 2: 1 field…\n'];
const VALID: MissingVerdict = { valid: true, details: '', errors: [] };
const OPEN_SIGNAL = new AbortController().signal;
const SAMPLED_CUSTOMER = { id: 'cus_1' };
const REJECTED_CUSTOMER = { customer: 'cus_1' };
const LIST_BASELINE = [{ id: 'a' }, { id: 'b', status: 'open' }, { id: 'c' }];
const LIST_ANSWER = [{ status: 'open' }, {}, { status: 'draft' }];

const validate = async (): Promise<MissingVerdict> => Promise.resolve(VALID);

const realSalvage = async (missing: MissingFile, candidates: unknown[], context: string): Promise<FillOutcome> =>
  Promise.resolve(missingSalvage(missing, candidates, context));

const failingSalvage = async (): Promise<FillOutcome> =>
  Promise.reject(new FixtureError('spec too expensive to sample/validate', 'raise the budget'));

const statusText = (progress: AiFixtureProgress): string => progress.text;

const ignoreProgress = (): void => undefined;

const chunkPaths = (call: [string, AiMissingRequest]): string[] => call[1].missing.paths;

describe('FEATURE: chunked CLI fill', (): void => {
  let missing: MissingFile;
  let salvage: Mock<MissingSalvager>;

  const fillRun = (fixture: unknown, enrich: AiMissingFactory, progress: AiFixtureProgress[], signal: AbortSignal): ChunkedFillRun => {
    const request: AiMissingRequest = { fixture, missing, scenario: 'overdue', validate };
    const onProgress = (entry: AiFixtureProgress): void => {
      progress.push(entry);
    };
    const run: ChunkedFillRun = { enrich, salvage, tool: 'codex', schemaName: 'invoice', request, signal, onProgress };

    return run;
  };

  beforeAll(async (): Promise<void> => {
    missing = await missingFixture('customer');
  });

  describe('GIVEN a fill that fits one chunk', (): void => {
    beforeAll((): void => {
      salvage = vi.fn<MissingSalvager>(realSalvage);
    });

    it('WHEN run THEN the whole request goes to one CLI run, every value comes from the model and no status is reported', async (): Promise<void> => {
      const enrich = vi.fn<AiMissingFactory>().mockResolvedValue(MERGED_ANSWER);
      const progress: AiFixtureProgress[] = [];
      const run = fillRun(INVOICE, enrich, progress, OPEN_SIGNAL);

      const outcome = await chunkedFill(run);

      expect(outcome).toStrictEqual({ populated: MERGED_ANSWER, sources: ALL_AI, notes: [] });
      expect(enrich.mock.calls).toStrictEqual([['invoice', run.request]]);
      expect(progress).toStrictEqual([]);
    });

    describe('WHEN its CLI run fails', (): void => {
      let outcome: FillOutcome;
      let progress: AiFixtureProgress[];

      beforeAll(async (): Promise<void> => {
        const enrich = vi.fn<AiMissingFactory>().mockRejectedValue(new Error('codex exited 1\nstack noise'));

        salvage.mockClear();
        progress = [];
        outcome = await chunkedFill(fillRun(INVOICE, enrich, progress, OPEN_SIGNAL));
      });

      it('THEN salvages the whole fill without candidates, naming the failure', (): void => {
        expect(salvage.mock.calls).toStrictEqual([[missing, [], 'codex failed: codex exited 1']]);
      });

      it('THEN resolves with the salvaged fill instead of failing', (): void => {
        expect(outcome.populated).toStrictEqual({ status: 'draft', customer: SAMPLED_CUSTOMER });
        expect(outcome.sources).toStrictEqual({ status: 'sampler', customer: 'sampler' });
        expect(outcome.notes).toStrictEqual(['codex failed: codex exited 1; 2 values filled from the schema.']);
      });

      it('THEN a status line says the schema fills in', (): void => {
        expect(progress.map(statusText)).toStrictEqual(['codex failed: codex exited 1; filling from the schema…\n']);
      });
    });

    it('WHEN the answer is rejected THEN the salvage builds on its parsed candidates', async (): Promise<void> => {
      const rejected = new AiFillRejectedError('generated missing fields violate schema "missing"', [REJECTED_CUSTOMER], '/customer');
      const enrich = vi.fn<AiMissingFactory>().mockRejectedValue(rejected);

      salvage.mockClear();

      await chunkedFill(fillRun(INVOICE, enrich, [], OPEN_SIGNAL));

      expect(salvage.mock.calls).toStrictEqual([[missing, [REJECTED_CUSTOMER], "codex's answer did not match the schema"]]);
    });

    it('WHEN no answer was JSON THEN the note says so', async (): Promise<void> => {
      const rejected = new AiFillRejectedError('codex returned invalid JSON after 2 attempts', [], 'Unexpected token');
      const enrich = vi.fn<AiMissingFactory>().mockRejectedValue(rejected);

      const outcome = await chunkedFill(fillRun(INVOICE, enrich, [], OPEN_SIGNAL));

      expect(outcome.notes).toStrictEqual(['codex returned text that is not JSON; 2 values filled from the schema.']);
    });
  });

  describe('GIVEN a salvage that fails too', (): void => {
    it('WHEN the CLI run fails THEN every path is unfilled and the note carries the reason and its fix', async (): Promise<void> => {
      salvage = vi.fn<MissingSalvager>(failingSalvage);
      const enrich = vi.fn<AiMissingFactory>().mockRejectedValue(new Error('codex exited 1'));

      const outcome = await chunkedFill(fillRun(INVOICE, enrich, [], OPEN_SIGNAL));

      const sources = { status: 'unfilled', customer: 'unfilled' };
      const notes = [
        'codex failed: codex exited 1; 2 values could not be filled: spec too expensive to sample/validate (raise the budget).'
      ];

      expect(outcome).toStrictEqual({ populated: {}, sources, notes });
    });
  });

  describe('GIVEN a fixture large enough for two chunks', (): void => {
    describe('WHEN run', (): void => {
      let enrich: Mock<AiMissingFactory>;
      let progress: AiFixtureProgress[];
      let outcome: FillOutcome;

      beforeAll(async (): Promise<void> => {
        salvage = vi.fn<MissingSalvager>(realSalvage);
        enrich = vi.fn<AiMissingFactory>().mockResolvedValueOnce(STATUS_ANSWER).mockResolvedValueOnce(CUSTOMER_ANSWER);
        progress = [];
        outcome = await chunkedFill(fillRun(LARGE_INVOICE, enrich, progress, OPEN_SIGNAL));
      });

      it('THEN each chunk runs the CLI once with only its paths, in order', (): void => {
        expect(enrich.mock.calls.map(chunkPaths)).toStrictEqual([['status'], ['customer']]);
      });

      it('THEN each chunk sends the full fixture, which the library digests and stages itself', (): void => {
        const request = enrich.mock.calls[1]?.[1];

        expect(request?.fixture).toBe(LARGE_INVOICE);
      });

      it('THEN each chunk keeps the scenario and the worker validator', (): void => {
        const request = enrich.mock.calls[1]?.[1];

        expect(request).toMatchObject({ scenario: 'overdue', validate });
      });

      it('THEN a status line announces each chunk', (): void => {
        expect(progress.map(statusText)).toStrictEqual(CHUNK_LINES);
      });

      it('THEN the chunk answers are merged into one result of model values', (): void => {
        expect(outcome).toStrictEqual({ populated: MERGED_ANSWER, sources: ALL_AI, notes: [] });
      });
    });

    describe('WHEN the second chunk fails', (): void => {
      let progress: AiFixtureProgress[];
      let outcome: FillOutcome;

      beforeAll(async (): Promise<void> => {
        const rejected = new AiFillRejectedError('codex returned invalid JSON after 2 attempts', [], 'Unexpected token');
        const enrich = vi.fn<AiMissingFactory>().mockResolvedValueOnce(STATUS_ANSWER).mockRejectedValueOnce(rejected);

        salvage = vi.fn<MissingSalvager>(realSalvage);
        progress = [];
        outcome = await chunkedFill(fillRun(LARGE_INVOICE, enrich, progress, OPEN_SIGNAL));
      });

      it('THEN keeps the first chunk answer and salvages only the second', (): void => {
        expect(outcome.populated).toStrictEqual({ status: 'draft', customer: SAMPLED_CUSTOMER });
        expect(outcome.sources).toStrictEqual({ status: 'ai', customer: 'sampler' });
      });

      it('THEN the note names the chunk', (): void => {
        expect(outcome.notes).toStrictEqual(['Chunk 2 of 2: codex returned text that is not JSON; 1 value filled from the schema.']);
      });

      it('THEN the salvage status follows the chunk status', (): void => {
        const salvageLine = 'Chunk 2 of 2: codex returned text that is not JSON; filling from the schema…\n';

        expect(progress.map(statusText)).toStrictEqual([...CHUNK_LINES, salvageLine]);
      });
    });
  });

  describe('GIVEN lone paths whose prompts exceed the 1 MiB CLI limit', (): void => {
    it('WHEN run THEN no CLI starts and each path is salvaged from the schema', async (): Promise<void> => {
      salvage = vi.fn<MissingSalvager>(realSalvage);
      const enrich = vi.fn<AiMissingFactory>();

      const outcome = await chunkedFill(fillRun(HUGE_INVOICE, enrich, [], OPEN_SIGNAL));

      expect(enrich).not.toHaveBeenCalled();
      expect(outcome.sources).toStrictEqual({ status: 'sampler', customer: 'sampler' });
      expect(outcome.notes[0]).toBe(
        'Chunk 1 of 2: its prompt alone exceeds the 1 MiB CLI input limit; 1 value filled from the schema.'
      );
    });
  });

  describe('GIVEN a list fixture whose missing paths start at an index', (): void => {
    let list: MissingFile;

    const listRun = (enrich: AiMissingFactory): ChunkedFillRun => {
      const request: AiMissingRequest = { fixture: LIST_BASELINE, missing: list, scenario: 'overdue', validate };
      const run: ChunkedFillRun = {
        enrich,
        salvage,
        tool: 'codex',
        schemaName: 'invoice',
        request,
        signal: OPEN_SIGNAL,
        onProgress: ignoreProgress
      };

      return run;
    };

    beforeAll(async (): Promise<void> => {
      list = await missingFixture('list');
      salvage = vi.fn<MissingSalvager>(realSalvage);
    });

    it('WHEN the model answers with a padded list THEN the fill is that list trimmed to the missing paths', async (): Promise<void> => {
      const enrich = vi.fn<AiMissingFactory>().mockResolvedValue(LIST_ANSWER);

      const outcome = await chunkedFill(listRun(enrich));

      expect(JSON.stringify(outcome.populated)).toBe('[{"status":"open"},null,{"status":"draft"}]');
      expect(outcome.sources).toStrictEqual({ '[0].status': 'ai', '[2].status': 'ai' });
    });

    it('WHEN the CLI run fails THEN the salvaged fill is still a list', async (): Promise<void> => {
      const enrich = vi.fn<AiMissingFactory>().mockRejectedValue(new Error('codex exited 1'));

      const outcome = await chunkedFill(listRun(enrich));

      expect(JSON.stringify(outcome.populated)).toBe('[{"status":"draft"},null,{"status":"draft"}]');
    });
  });

  describe('GIVEN the fill is canceled during the first chunk', (): void => {
    it('WHEN run THEN rejects with the cancel reason and no further chunk starts', async (): Promise<void> => {
      const controller = new AbortController();
      const cancelDuringRun: AiMissingFactory = async (): Promise<Record<string, unknown>> => {
        controller.abort(new Error('the client disconnected'));

        return Promise.resolve(STATUS_ANSWER);
      };
      const enrich = vi.fn<AiMissingFactory>(cancelDuringRun);
      const run = fillRun(LARGE_INVOICE, enrich, [], controller.signal);

      const filling = chunkedFill(run);

      await expect(filling).rejects.toThrow('the client disconnected');
      expect(enrich).toHaveBeenCalledTimes(1);
    });

    it('WHEN the cancel comes during the salvage THEN rejects with the cancel reason instead of an unfilled result', async (): Promise<void> => {
      const controller = new AbortController();
      const cancelDuringSalvage = async (): Promise<FillOutcome> => {
        controller.abort(new Error('the client disconnected'));

        return Promise.reject(new Error('the salvage worker was terminated'));
      };
      const enrich = vi.fn<AiMissingFactory>().mockRejectedValue(new Error('codex exited 1'));

      salvage = vi.fn<MissingSalvager>(cancelDuringSalvage);

      const filling = chunkedFill(fillRun(INVOICE, enrich, [], controller.signal));

      await expect(filling).rejects.toThrow('the client disconnected');
    });

    it('WHEN the CLI run rejects because of the cancel THEN rejects with the cancel reason and nothing is salvaged', async (): Promise<void> => {
      const controller = new AbortController();
      const abortedRun: AiMissingFactory = async (): Promise<Record<string, unknown>> => {
        controller.abort(new Error('the client disconnected'));

        return Promise.reject(new Error('codex was terminated'));
      };

      salvage = vi.fn<MissingSalvager>(realSalvage);

      const filling = chunkedFill(fillRun(INVOICE, abortedRun, [], controller.signal));

      await expect(filling).rejects.toThrow('the client disconnected');
      expect(salvage).not.toHaveBeenCalled();
    });
  });
});
