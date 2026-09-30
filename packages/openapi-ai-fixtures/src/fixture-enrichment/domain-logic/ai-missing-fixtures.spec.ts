import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aiMissingFixture } from './ai-missing-fixtures.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { AiMissingRequest, MissingFile, MissingValidator, MissingVerdict } from '../../missing-values/common/missing.type.ts';
import { missingDocument } from '../../missing-values/utils/missing-document.util.ts';
import { parseMissingFile } from '../../missing-values/utils/missing-file.util.ts';
import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { agentResponse } from '../../test/utils/agent-response.spec.util.ts';
import { integrationFile } from '../../test/utils/integration-project.spec.util.ts';
import { AiFillRejectedError } from '../common/ai-fill-rejected.error.ts';

vi.mock('../../agent-process/data-access/agent-process.client.ts');

const SCENARIO = 'Fill the absent status with an open invoice state.';
const CORRUPT = { id: 'in_base', amount_due: 0 };
const FILLED = { status: 'open' };
const UNLISTED = { status: 'paid' };
const OVERSIZED_SCHEMA = { type: 'string', description: 'x'.repeat(1024 * 1024) };
const UNCOMPILABLE_SCHEMA = { type: 'string', pattern: '(' };
const VALID: MissingVerdict = { valid: true, details: '', errors: [] };
const INVALID: MissingVerdict = { valid: false, details: '/status: must be paid', errors: [] };
const NOT_JSON = 'I could not produce the fixture.';
const STATUS_SCHEMA = { type: 'string', enum: ['draft', 'open'] };
const STATUS_PROPERTIES = { status: STATUS_SCHEMA };
const STATUS_ITEM = { type: 'object', required: ['status'], properties: STATUS_PROPERTIES };
const LIST_SCHEMA = { type: 'array', items: STATUS_ITEM };
const LIST_ANSWER = [{ status: 'draft' }];
const LIST_BASELINE = [{ id: 'a' }, { id: 'b', status: 'open' }];

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

  const [request] = call;
  const parsed: unknown = JSON.parse(request.input);

  if (!isSchemaRecord(parsed)) throw new Error('the prompt payload is not a JSON object');

  return parsed;
};

describe('FEATURE: AI fill of diffed missing fields', (): void => {
  describe('GIVEN a corrupt invoice, its missing projection, and an offline harness', (): void => {
    let missing: MissingFile;
    let options: AiFixtureOptions;
    let request: AiMissingRequest;

    beforeEach(async (): Promise<void> => {
      vi.resetAllMocks();

      const text = await readFile(integrationFile('missing.json'), 'utf8');

      missing = parseMissingFile(text);
      options = { tool: 'claude', timeoutMs: 10000 };
      request = { fixture: CORRUPT, missing, scenario: SCENARIO };
    });

    it('WHEN the harness returns only the absent keys in the concrete shape instead of by pattern THEN returns the validated fill', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

      const enrich = aiMissingFixture(options);
      const result = await enrich('invoice', request);

      expect(result).toStrictEqual(FILLED);
    });

    it('WHEN the harness answers THEN the prompt carries the pruned document and the corrupt baseline as its digest', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

      const enrich = aiMissingFixture(options);

      await enrich('invoice', request);

      const prompt = agentPrompt();
      const document = missingDocument(missing);

      expect(prompt['digest']).toStrictEqual(CORRUPT);
      expect(prompt['missing']).toStrictEqual(document);
      expect(prompt['scenario']).toBe(SCENARIO);
    });

    it('WHEN the harness answers THEN the prompt never carries the full specification', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

      const enrich = aiMissingFixture(options);

      await enrich('invoice', request);

      const keys = Object.keys(agentPrompt()).toSorted();

      expect(keys).toStrictEqual(['digest', 'files', 'instructions', 'missing', 'patterns', 'scenario']);
    });

    it('WHEN the projection is oversized THEN rejects before invoking the harness', async (): Promise<void> => {
      const oversized: MissingFile = { ...missing, schema: OVERSIZED_SCHEMA };
      const enrich = aiMissingFixture(options);
      const huge: AiMissingRequest = { ...request, missing: oversized };

      await expect(enrich('invoice', huge)).rejects.toThrow(/1 MiB agent input limit/);
      expect(vi.mocked(runAgent)).not.toHaveBeenCalled();
    });

    it('WHEN the filled value breaks the projection THEN rejects with the failing path', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(UNLISTED)));

      const enrich = aiMissingFixture(options);

      await expect(enrich('invoice', request)).rejects.toThrow(/generated missing fields violate schema "missing": \/status/);
    });

    it('WHEN the first fill breaks the projection and the repair fits THEN returns the repaired fill', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', JSON.stringify(UNLISTED)));
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', JSON.stringify(FILLED)));

      const enrich = aiMissingFixture(options);
      const result = await enrich('invoice', request);

      expect(result).toStrictEqual(FILLED);
      expect(runAgent).toHaveBeenCalledTimes(2);
    });

    describe('WHEN both answers break the projection', (): void => {
      it('THEN rejects with every parsed candidate and the problem', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', JSON.stringify(UNLISTED)));
        vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', JSON.stringify(CORRUPT)));

        const enrich = aiMissingFixture(options);
        const error = await rejection(enrich('invoice', request));

        expect(error.candidates).toStrictEqual([UNLISTED, CORRUPT]);
        expect(error.problem).toMatch(/status/);
      });

      it('THEN keeps the CLI message', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(UNLISTED)));

        const enrich = aiMissingFixture(options);
        const error = await rejection(enrich('invoice', request));

        expect(error.message).toMatch(/^generated missing fields violate schema "missing": \/status/);
      });
    });

    it('WHEN the best-ranked value breaks the projection but another value in the answer fits THEN returns that one without a repair', async (): Promise<void> => {
      const prose = 'Before: {"status":"paid","note":"old","count":1} After: {"status":"open"}';

      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', prose));

      const enrich = aiMissingFixture(options);
      const result = await enrich('invoice', request);

      expect(result).toStrictEqual(FILLED);
      expect(runAgent).toHaveBeenCalledTimes(1);
    });

    it('WHEN the repair is cancelled after a parsed first answer THEN rejects with the cancel reason, not a salvageable rejection', async (): Promise<void> => {
      const controller = new AbortController();
      const reason = new Error('the client disconnected');
      const cancelled: AiFixtureOptions = { ...options, signal: controller.signal };
      const cancelDuringRepair = async (): Promise<never> => {
        controller.abort(reason);

        return Promise.reject(new Error('claude was terminated'));
      };

      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', JSON.stringify(UNLISTED)));
      vi.mocked(runAgent).mockImplementationOnce(cancelDuringRepair);

      const enrich = aiMissingFixture(cancelled);

      await expect(enrich('invoice', request)).rejects.toBe(reason);
    });

    it('WHEN each answer holds several JSON values THEN every one reaches the candidates, the chosen value last', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', 'Per [1]: {"status":"paid"}'));

      const enrich = aiMissingFixture(options);
      const error = await rejection(enrich('invoice', request));

      expect(error.candidates).toStrictEqual([[1], UNLISTED, [1], UNLISTED]);
    });

    describe('WHEN neither answer is JSON', (): void => {
      it('THEN rejects with no candidates and the CLI message', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', NOT_JSON));

        const enrich = aiMissingFixture(options);
        const error = await rejection(enrich('invoice', request));

        expect(error.candidates).toStrictEqual([]);
        expect(error.message).toBe('claude returned invalid JSON after 2 attempts');
        expect(error.problem).toMatch(/JSON/);
      });
    });

    it('WHEN the first answer breaks the projection and the repair is not JSON THEN rejects with the first candidate', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', JSON.stringify(UNLISTED)));
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', NOT_JSON));

      const enrich = aiMissingFixture(options);
      const error = await rejection(enrich('invoice', request));

      expect(error.candidates).toStrictEqual([UNLISTED]);
      expect(error.message).toBe('claude returned invalid JSON after 2 attempts');
    });

    describe('WHEN the repair run itself fails after a parsed first answer', (): void => {
      it('THEN rejects with the first answer as a candidate and the run failure as the message', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', JSON.stringify(UNLISTED)));
        vi.mocked(runAgent).mockRejectedValueOnce(new Error('claude exited 1'));

        const enrich = aiMissingFixture(options);
        const error = await rejection(enrich('invoice', request));

        expect(error.candidates).toStrictEqual([UNLISTED]);
        expect(error.message).toBe('claude exited 1');
        expect(error.cause).toBeInstanceOf(Error);
      });
    });

    it('WHEN the first run fails before any answer THEN its error propagates unchanged', async (): Promise<void> => {
      const failure = new Error('claude exited 1');

      vi.mocked(runAgent).mockRejectedValue(failure);

      const enrich = aiMissingFixture(options);

      await expect(enrich('invoice', request)).rejects.toBe(failure);
    });

    it('WHEN a required missing key is absent THEN rejects rather than returning a partial fill', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', '{}'));

      const enrich = aiMissingFixture(options);

      await expect(enrich('invoice', request)).rejects.toThrow(/generated missing fields violate schema "missing"/);
    });

    it('WHEN the projection cannot compile THEN rejects before invoking the harness', async (): Promise<void> => {
      const uncompilable: MissingFile = { ...missing, schema: UNCOMPILABLE_SCHEMA };
      const broken: AiMissingRequest = { ...request, missing: uncompilable };
      const enrich = aiMissingFixture(options);

      const filling = enrich('invoice', broken);

      await expect(filling).rejects.toThrow(/Invalid regular expression/);
      expect(vi.mocked(runAgent)).not.toHaveBeenCalled();
    });

    describe('WHEN a validator is injected', (): void => {
      it('THEN it judges the missing file and the fill instead of the in-process schema', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(UNLISTED)));
        const validate = vi.fn<MissingValidator>(async (): Promise<MissingVerdict> => Promise.resolve(VALID));
        const injected: AiMissingRequest = { ...request, validate };
        const enrich = aiMissingFixture(options);

        const result = await enrich('invoice', injected);

        expect(validate).toHaveBeenCalledWith(missing, UNLISTED);
        expect(result).toStrictEqual(UNLISTED);
      });

      it('THEN its invalid verdict rejects with its details', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));
        const validate = vi.fn<MissingValidator>(async (): Promise<MissingVerdict> => Promise.resolve(INVALID));
        const injected: AiMissingRequest = { ...request, validate };
        const enrich = aiMissingFixture(options);

        const filling = enrich('invoice', injected);

        await expect(filling).rejects.toThrow('generated missing fields violate schema "missing": /status: must be paid');
      });

      it('THEN a valid verdict on a non-object fill still rejects', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', '[]'));
        const validate = vi.fn<MissingValidator>(async (): Promise<MissingVerdict> => Promise.resolve(VALID));
        const injected: AiMissingRequest = { ...request, validate };
        const enrich = aiMissingFixture(options);

        const filling = enrich('invoice', injected);

        await expect(filling).rejects.toThrow('generated missing fields violate schema "missing": the fill must be one JSON object');
      });

      it('THEN its rejection propagates unchanged', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));
        const validate = vi.fn<MissingValidator>(async (): Promise<MissingVerdict> =>
          Promise.reject(new Error('validation timed out'))
        );
        const injected: AiMissingRequest = { ...request, validate };
        const enrich = aiMissingFixture(options);

        const filling = enrich('invoice', injected);

        await expect(filling).rejects.toThrow('validation timed out');
      });
    });

    describe('WHEN the fixture is a list and its missing paths start at an index', (): void => {
      let list: AiMissingRequest;

      beforeEach((): void => {
        const listMissing: MissingFile = { ...missing, paths: ['[0].status'], schema: LIST_SCHEMA };

        list = { ...request, fixture: LIST_BASELINE, missing: listMissing };
      });

      it('THEN a list answer that fits the projection is returned', async (): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(LIST_ANSWER)));

        const enrich = aiMissingFixture(options);
        const result = await enrich('invoice', list);

        expect(result).toStrictEqual(LIST_ANSWER);
      });

      it('THEN a list answer wrapped in prose next to a bigger object is found without a repair', async (): Promise<void> => {
        const prose = 'Element [1] was {"status":"x","id":"in_b"}; full answer: [{"status":"draft"}]';

        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', prose));

        const enrich = aiMissingFixture(options);
        const result = await enrich('invoice', list);

        expect(result).toStrictEqual(LIST_ANSWER);
        expect(runAgent).toHaveBeenCalledTimes(1);
      });

      it('THEN an object answer still rejects', async (): Promise<void> => {
        const validate = vi.fn<MissingValidator>(async (): Promise<MissingVerdict> => Promise.resolve(VALID));

        vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

        const enrich = aiMissingFixture(options);
        const filling = enrich('invoice', { ...list, validate });

        await expect(filling).rejects.toThrow('generated missing fields violate schema "missing": the fill must be one JSON array');
      });
    });

    it('WHEN the scenario is blank THEN rejects before invoking the harness', async (): Promise<void> => {
      const blank: AiMissingRequest = { ...request, scenario: '   ' };
      const enrich = aiMissingFixture(options);

      await expect(enrich('invoice', blank)).rejects.toThrow(/scenario/);
      expect(vi.mocked(runAgent)).not.toHaveBeenCalled();
    });

    it('WHEN the schema name disagrees with the projection THEN rejects before invoking the harness', async (): Promise<void> => {
      const enrich = aiMissingFixture(options);

      await expect(enrich('receipt', request)).rejects.toThrow(/diffed against schema "invoice", not "receipt"/);
      expect(vi.mocked(runAgent)).not.toHaveBeenCalled();
    });

    it('WHEN canceled before invocation THEN does not invoke the harness', async (): Promise<void> => {
      const controller = new AbortController();
      const canceled: AiFixtureOptions = { ...options, signal: controller.signal };
      const enrich = aiMissingFixture(canceled);

      controller.abort(new Error('generation canceled'));

      await expect(enrich('invoice', request)).rejects.toThrow('generation canceled');
      expect(vi.mocked(runAgent)).not.toHaveBeenCalled();
    });

    it('WHEN filling THEN leaves the corrupt baseline and the missing file unchanged', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

      const before = JSON.stringify({ CORRUPT, missing });
      const enrich = aiMissingFixture(options);

      await enrich('invoice', request);

      const after = JSON.stringify({ CORRUPT, missing });

      expect(after).toBe(before);
    });
  });
});
