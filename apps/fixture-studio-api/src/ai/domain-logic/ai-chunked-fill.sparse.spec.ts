import { pathTree } from '@fixture-automation/openapi-ai-fixtures';
import type { AiMissingRequest, MissingFill, MissingVerdict, PathValue } from '@fixture-automation/openapi-ai-fixtures';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { chunkedFill } from './ai-chunked-fill.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import type { ChunkedFillRun, FillOutcome, MissingSalvager } from '../common/ai.type.ts';

const DESCRIBED_SCHEMA = { type: 'string', description: 'd'.repeat(100 * 1024) };
const LINE_PROPERTIES = { f0: DESCRIBED_SCHEMA, f1: DESCRIBED_SCHEMA, f2: DESCRIBED_SCHEMA, f3: DESCRIBED_SCHEMA };
const LINE_ITEM = { type: 'object', properties: LINE_PROPERTIES };
const LINES_SCHEMA = { type: 'array', items: LINE_ITEM };
const ORDER_PROPERTIES = { lines: LINES_SCHEMA };
const ORDER_SCHEMA = { type: 'object', properties: ORDER_PROPERTIES };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const COMPONENTS = { schemas: EMPTY_SCHEMAS };
const ODD_PATHS = ['lines[1].f0', 'lines[3].f0', 'lines[1].f1', 'lines[3].f1'];
const EVEN_PATHS = ['lines[0].f2', 'lines[2].f2', 'lines[3].f2', 'lines[0].f3', 'lines[2].f3', 'lines[3].f3'];
const PATHS = [...ODD_PATHS, ...EVEN_PATHS];
const MISSING: MissingFile = { schemaName: 'order', dialect: 'openapi-30', paths: PATHS, schema: ORDER_SCHEMA, components: COMPONENTS };
const BASELINE_LINES = [{ id: 'l0' }, { id: 'l1' }, { id: 'l2' }, { id: 'l3' }];
const BASELINE = { lines: BASELINE_LINES };
const VALID: MissingVerdict = { valid: true, details: '', errors: [] };
const LINE_0 = { f2: 'lines[0].f2', f3: 'lines[0].f3' };
const LINE_1 = { f0: 'lines[1].f0', f1: 'lines[1].f1' };
const LINE_2 = { f2: 'lines[2].f2', f3: 'lines[2].f3' };
const LINE_3 = { f0: 'lines[3].f0', f1: 'lines[3].f1', f2: 'lines[3].f2', f3: 'lines[3].f3' };
const MERGED_LINES = [LINE_0, LINE_1, LINE_2, LINE_3];
const MERGED = { lines: MERGED_LINES };

const validate = async (): Promise<MissingVerdict> => Promise.resolve(VALID);

const ignoreProgress = (): void => undefined;

const pathValue = (path: string): PathValue => {
  const entry: PathValue = { path, value: path };

  return entry;
};

/** Answers each chunk the way the library returns a sparse fill: values at the chunk's paths, holes elsewhere. */
const sparseAnswer = async (_name: string, request: AiMissingRequest): Promise<MissingFill> => {
  const entries = request.missing.paths.map(pathValue);
  const fill = pathTree(entries, false);

  return Promise.resolve(fill);
};

const chunkPaths = (call: [string, AiMissingRequest]): string[] => call[1].missing.paths;

describe('FEATURE: chunked CLI fill at sparse array indices', (): void => {
  describe('GIVEN odd lines missing f0 and f1, even lines and the last line missing f2 and f3, over budget for one chunk', (): void => {
    const enrich = vi.fn(sparseAnswer);
    const salvage = vi.fn<MissingSalvager>();
    let outcome: FillOutcome;

    beforeAll(async (): Promise<void> => {
      const request: AiMissingRequest = { fixture: BASELINE, missing: MISSING, scenario: 'overdue', validate };
      const run: ChunkedFillRun = {
        enrich,
        salvage,
        tool: 'claude',
        schemaName: 'order',
        request,
        signal: new AbortController().signal,
        onProgress: ignoreProgress
      };

      outcome = await chunkedFill(run);
    });

    it('WHEN run THEN each chunk asks for its own patterns only', (): void => {
      expect(enrich.mock.calls.map(chunkPaths)).toStrictEqual([ODD_PATHS, EVEN_PATHS]);
    });

    it('WHEN the sparse answers merge THEN no chunk hole erases another chunk value', (): void => {
      expect(outcome.populated).toStrictEqual(MERGED);
    });

    it('WHEN the sparse answers merge THEN nothing is salvaged', (): void => {
      expect(salvage).not.toHaveBeenCalled();
      expect(outcome.notes).toStrictEqual([]);
    });
  });
});
