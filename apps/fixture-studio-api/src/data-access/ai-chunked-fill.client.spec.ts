import type { AiFixtureProgress, AiMissingFactory, AiMissingRequest, MissingVerdict } from '@fixture-automation/openapi-ai-fixtures';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { chunkedFill } from './ai-chunked-fill.client.ts';
import type { ChunkedFillRun } from '../common/studio-server.type.ts';
import type { MissingFile } from '../contract/common/studio-api.type.ts';
import { missingFixture } from '../test/utils/studio-spec.spec.util.ts';

const INVOICE = { id: 'in_9', amount_due: 5 };
const LARGE_INVOICE = { ...INVOICE, memo: 'm'.repeat(300 * 1024) };
const STATUS_ANSWER = { status: 'draft' };
const CUSTOMER = { id: 'cus_1' };
const CUSTOMER_ANSWER = { customer: CUSTOMER };
const MERGED_ANSWER = { status: 'draft', customer: CUSTOMER };
const CHUNK_LINES = ['Chunk 1 of 2: 1 field…\n', 'Chunk 2 of 2: 1 field…\n'];
const VALID: MissingVerdict = { valid: true, details: '' };
const OPEN_SIGNAL = new AbortController().signal;

const validate = async (): Promise<MissingVerdict> => Promise.resolve(VALID);

const statusText = (progress: AiFixtureProgress): string => progress.text;

const chunkPaths = (call: [string, AiMissingRequest]): string[] => call[1].missing.paths;

describe('FEATURE: chunked CLI fill', (): void => {
  let missing: MissingFile;

  const fillRun = (fixture: unknown, enrich: AiMissingFactory, progress: AiFixtureProgress[], signal: AbortSignal): ChunkedFillRun => {
    const request: AiMissingRequest = { fixture, missing, scenario: 'overdue', validate };
    const onProgress = (entry: AiFixtureProgress): void => {
      progress.push(entry);
    };
    const run: ChunkedFillRun = { enrich, schemaName: 'invoice', request, signal, onProgress };

    return run;
  };

  beforeAll(async (): Promise<void> => {
    missing = await missingFixture('customer');
  });

  describe('GIVEN a fill that fits one chunk', (): void => {
    it('WHEN run THEN the whole request goes to one CLI run and no chunk status is reported', async (): Promise<void> => {
      const enrich = vi.fn<AiMissingFactory>().mockResolvedValue(MERGED_ANSWER);
      const progress: AiFixtureProgress[] = [];
      const run = fillRun(INVOICE, enrich, progress, OPEN_SIGNAL);

      const populated = await chunkedFill(run);

      expect(populated).toStrictEqual(MERGED_ANSWER);
      expect(enrich.mock.calls).toStrictEqual([['invoice', run.request]]);
      expect(progress).toStrictEqual([]);
    });
  });

  describe('GIVEN a fixture large enough for two chunks', (): void => {
    describe('WHEN run', (): void => {
      let enrich: Mock<AiMissingFactory>;
      let progress: AiFixtureProgress[];
      let populated: Record<string, unknown>;

      beforeAll(async (): Promise<void> => {
        enrich = vi.fn<AiMissingFactory>().mockResolvedValueOnce(STATUS_ANSWER).mockResolvedValueOnce(CUSTOMER_ANSWER);
        progress = [];
        populated = await chunkedFill(fillRun(LARGE_INVOICE, enrich, progress, OPEN_SIGNAL));
      });

      it('THEN each chunk runs the CLI once with only its paths, in order', (): void => {
        expect(enrich.mock.calls.map(chunkPaths)).toStrictEqual([['status'], ['customer']]);
      });

      it('THEN each chunk keeps the scenario and the worker validator', (): void => {
        const request = enrich.mock.calls[1]?.[1];

        expect(request).toMatchObject({ scenario: 'overdue', validate });
      });

      it('THEN a status line announces each chunk', (): void => {
        expect(progress.map(statusText)).toStrictEqual(CHUNK_LINES);
      });

      it('THEN the chunk answers are merged into one result', (): void => {
        expect(populated).toStrictEqual(MERGED_ANSWER);
      });
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
  });
});
