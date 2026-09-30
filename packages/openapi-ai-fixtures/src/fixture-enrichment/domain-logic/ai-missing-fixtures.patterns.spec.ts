import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aiMissingFixture } from './ai-missing-fixtures.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { AiMissingRequest, MissingFile, MissingValidator, MissingVerdict } from '../../missing-values/common/missing.type.ts';
import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { agentCommand } from '../../test/utils/agent-model.spec.util.ts';
import { agentResponse } from '../../test/utils/agent-response.spec.util.ts';
import { AiFillRejectedError } from '../common/ai-fill-rejected.error.ts';

vi.mock('../../agent-process/data-access/agent-process.client.ts');

const SCENARIO = 'Fill the absent line quantities and skus.';
const LINE_COUNT = 5;
const QUANTITY_SCHEMA = { type: 'integer', minimum: 1 };
const SKU_SCHEMA = { type: 'string', pattern: '^SKU-' };
const LINE_PROPERTIES = { qty: QUANTITY_SCHEMA, sku: SKU_SCHEMA };
const LINE_ITEM = { type: 'object', required: ['qty', 'sku'], properties: LINE_PROPERTIES };
const LINES_SCHEMA = { type: 'array', items: LINE_ITEM };
const PROJECTION_PROPERTIES = { lines: LINES_SCHEMA };
const PROJECTION = { type: 'object', required: ['lines'], properties: PROJECTION_PROPERTIES };
const STATUS_SCHEMA = { type: 'string', enum: ['draft', 'open'] };
const STATUS_PROPERTIES = { status: STATUS_SCHEMA };
const STATUS_ITEM = { type: 'object', required: ['status'], properties: STATUS_PROPERTIES };
const LIST_SCHEMA = { type: 'array', items: STATUS_ITEM };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const COMPONENTS = { schemas: EMPTY_SCHEMAS };
const VALID: MissingVerdict = { valid: true, details: '', errors: [] };
const PATTERN_ANSWER = { 'lines[*].qty': [2, 5], 'lines[*].sku': ['SKU-{n}'] };
const INVALID_ANSWER = { 'lines[*].qty': [0], 'lines[*].sku': ['SKU-{n}'] };
const EXPANDED_LINES = [
  { qty: 2, sku: 'SKU-1' },
  { qty: 5, sku: 'SKU-2' },
  { qty: 2, sku: 'SKU-3' },
  { qty: 5, sku: 'SKU-4' },
  { qty: 2, sku: 'SKU-5' }
];
const EXPANDED_FILL = { lines: EXPANDED_LINES };
const INVALID_LINES = [
  { qty: 0, sku: 'SKU-1' },
  { qty: 0, sku: 'SKU-2' },
  { qty: 0, sku: 'SKU-3' },
  { qty: 0, sku: 'SKU-4' },
  { qty: 0, sku: 'SKU-5' }
];
const INVALID_FILL = { lines: INVALID_LINES };

const linePaths = (field: string): string[] =>
  Array.from({ length: LINE_COUNT }, (_value: unknown, index: number): string => `lines[${index}].${field}`);

const lineAt = (_value: unknown, index: number): unknown => {
  const line = { id: `line_${index}` };

  return line;
};

const LINES = Array.from({ length: LINE_COUNT }, lineAt);
const FIXTURE = { id: 'in_1', lines: LINES };
const QUANTITY_PATHS = linePaths('qty');
const SKU_PATHS = linePaths('sku');
const PATHS = [...QUANTITY_PATHS, ...SKU_PATHS];
const MISSING: MissingFile = {
  schemaName: 'invoice',
  dialect: 'openapi-30',
  paths: PATHS,
  schema: PROJECTION,
  components: COMPONENTS
};
const OPTIONS: AiFixtureOptions = { tool: 'claude', timeoutMs: 10000 };
const CODEX_DIGEST_ONLY =
  'Codex reads no files: its read-only sandbox cannot confine reads to the scratch directory, so it gets the digest only.\n';
const REQUEST: AiMissingRequest = { fixture: FIXTURE, missing: MISSING, scenario: SCENARIO };

const answer = (value: unknown): string => agentResponse('claude', JSON.stringify(value));

const rejection = async (filling: Promise<unknown>): Promise<AiFillRejectedError> => {
  try {
    await filling;
  } catch (error: unknown) {
    if (error instanceof AiFillRejectedError) return error;

    throw error;
  }

  throw new Error('the fill did not reject');
};

const agentPrompt = (): Record<string, unknown> => {
  const [call] = vi.mocked(runAgent).mock.calls;

  if (call === undefined) throw new Error('runAgent was not called');

  const parsed: unknown = JSON.parse(call[0].input);

  if (!isSchemaRecord(parsed)) throw new Error('the prompt payload is not a JSON object');

  return parsed;
};

describe('FEATURE: AI fill of diffed missing fields by path pattern', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN an invoice whose 5 lines each lack a quantity and a sku', (): void => {
    it('WHEN the harness answers THEN the prompt lists each pattern with its count and a digest of the first 3 lines', async (): Promise<void> => {
      const patterns = [
        { pattern: 'lines[*].qty', count: LINE_COUNT },
        { pattern: 'lines[*].sku', count: LINE_COUNT }
      ];
      const digest = { id: 'in_1', lines: LINES.slice(0, 3) };

      vi.mocked(runAgent).mockResolvedValue(answer(PATTERN_ANSWER));

      await aiMissingFixture(OPTIONS)('invoice', REQUEST);

      const prompt = agentPrompt();

      expect(prompt['patterns']).toStrictEqual(patterns);
      expect(prompt['digest']).toStrictEqual(digest);
    });

    it('WHEN the harness answers by pattern THEN returns the expanded, validated fill', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(answer(PATTERN_ANSWER));

      const result = await aiMissingFixture(OPTIONS)('invoice', REQUEST);

      expect(result).toStrictEqual(EXPANDED_FILL);
      expect(runAgent).toHaveBeenCalledTimes(1);
    });

    it('WHEN a validator is injected THEN it judges the expanded fill', async (): Promise<void> => {
      const validate = vi.fn<MissingValidator>(async (): Promise<MissingVerdict> => Promise.resolve(VALID));
      const injected: AiMissingRequest = { ...REQUEST, validate };

      vi.mocked(runAgent).mockResolvedValue(answer(PATTERN_ANSWER));

      await aiMissingFixture(OPTIONS)('invoice', injected);

      expect(validate).toHaveBeenCalledWith(MISSING, EXPANDED_FILL);
    });

    it('WHEN the expanded first answer breaks the projection THEN the repair round runs and its expansion is returned', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValueOnce(answer(INVALID_ANSWER));
      vi.mocked(runAgent).mockResolvedValueOnce(answer(PATTERN_ANSWER));

      const result = await aiMissingFixture(OPTIONS)('invoice', REQUEST);

      expect(result).toStrictEqual(EXPANDED_FILL);
      expect(runAgent).toHaveBeenCalledTimes(2);
    });

    it('WHEN both expanded answers break the projection THEN the rejection candidates are the expanded fills', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(answer(INVALID_ANSWER));

      const error = await rejection(aiMissingFixture(OPTIONS)('invoice', REQUEST));

      expect(error.candidates).toStrictEqual([INVALID_FILL, INVALID_FILL]);
      expect(error.problem).toMatch(/\/lines\/0\/qty/);
    });

    it('WHEN one pattern is left out THEN its paths stay absent and the projection rejects the fill', async (): Promise<void> => {
      const partial = { 'lines[*].qty': [2] };

      vi.mocked(runAgent).mockResolvedValue(answer(partial));

      const error = await rejection(aiMissingFixture(OPTIONS)('invoice', REQUEST));

      expect(error.problem).toMatch(/sku/);
    });
  });

  describe('GIVEN a list fixture whose elements lack a status', (): void => {
    it('WHEN the harness answers by pattern THEN returns the expanded list', async (): Promise<void> => {
      const listMissing: MissingFile = { ...MISSING, paths: ['[0].status', '[1].status'], schema: LIST_SCHEMA };
      const fixture = [{ id: 'a' }, { id: 'b' }];
      const list: AiMissingRequest = { ...REQUEST, fixture, missing: listMissing };
      const listAnswer = { '[*].status': ['draft', 'open'] };

      vi.mocked(runAgent).mockResolvedValue(answer(listAnswer));

      const result = await aiMissingFixture(OPTIONS)('invoice', list);

      expect(result).toStrictEqual([{ status: 'draft' }, { status: 'open' }]);
    });
  });

  describe('GIVEN Claude in its default file mode', (): void => {
    beforeEach((): void => {
      vi.mocked(runAgent).mockResolvedValue(answer(PATTERN_ANSWER));
    });

    it('WHEN the harness answers THEN the whole fixture is staged as indented JSON in baseline.json', async (): Promise<void> => {
      const baseline = { path: 'baseline.json', content: JSON.stringify(FIXTURE, null, 2) };

      await aiMissingFixture(OPTIONS)('invoice', REQUEST);

      expect(agentCommand(vi.mocked(runAgent).mock.calls).files).toStrictEqual([baseline]);
    });

    it('WHEN the harness answers THEN the prompt names the staged baseline', async (): Promise<void> => {
      await aiMissingFixture(OPTIONS)('invoice', REQUEST);

      expect(agentPrompt()['files']).toStrictEqual({ baseline: 'baseline.json' });
    });
  });

  describe('GIVEN file mode forced off', (): void => {
    const digestOnly: AiFixtureOptions = { ...OPTIONS, readsFiles: false };

    beforeEach((): void => {
      vi.mocked(runAgent).mockResolvedValue(answer(PATTERN_ANSWER));
    });

    it('WHEN the harness answers THEN nothing is staged', async (): Promise<void> => {
      await aiMissingFixture(digestOnly)('invoice', REQUEST);

      expect(agentCommand(vi.mocked(runAgent).mock.calls).files).toStrictEqual([]);
    });

    it('WHEN the harness answers THEN the prompt keeps its digest-only keys and restrictions', async (): Promise<void> => {
      await aiMissingFixture(digestOnly)('invoice', REQUEST);

      const prompt = agentPrompt();

      expect(Object.keys(prompt)).toStrictEqual(['instructions', 'missing', 'patterns', 'digest', 'scenario']);
      expect(prompt['instructions']).toHaveProperty(
        'restrictions',
        'Do not access tools, code, project files, or external resources.'
      );
    });
  });

  describe('GIVEN Codex asked to read files', (): void => {
    const statuses: string[] = [];
    const onProgress = (progress: AiFixtureProgress): void => {
      if (progress.stream === 'status') statuses.push(progress.text);
    };
    const codex: AiFixtureOptions = { tool: 'codex', readsFiles: true, onProgress };

    beforeEach((): void => {
      statuses.length = 0;
      vi.mocked(runAgent).mockResolvedValue(agentResponse('codex', JSON.stringify(PATTERN_ANSWER)));
    });

    it('WHEN the harness answers THEN one status line says why it gets the digest only', async (): Promise<void> => {
      await aiMissingFixture(codex)('invoice', REQUEST);

      expect(statuses).toStrictEqual([CODEX_DIGEST_ONLY]);
    });

    it('WHEN the harness answers THEN the prompt names no files', async (): Promise<void> => {
      await aiMissingFixture(codex)('invoice', REQUEST);

      expect(agentPrompt()).not.toHaveProperty('files');
    });
  });
});
