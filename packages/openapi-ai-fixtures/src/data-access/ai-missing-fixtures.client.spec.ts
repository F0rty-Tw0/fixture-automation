import { readFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { aiMissingFixture } from './ai-missing-fixtures.client.ts';
import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';
import type { AiMissingRequest, MissingFile } from '../common/missing.type.ts';
import { agentResponse } from '../test/utils/agent-response.spec.util.ts';
import { integrationFile } from '../test/utils/integration-project.spec.util.ts';
import { missingDocument } from '../utils/missing-document.util.ts';
import { parseMissingFile } from '../utils/missing-file.util.ts';
import { isSchemaRecord } from '../utils/schema-record.util.ts';

vi.mock('./agent-process.client.ts');

const SCENARIO = 'Fill the absent status with an open invoice state.';
const CORRUPT = { id: 'in_base', amount_due: 0 };
const FILLED = { status: 'open' };
const UNLISTED = { status: 'paid' };
const OVERSIZED_SCHEMA = { type: 'string', description: 'x'.repeat(1024 * 1024) };

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

    it('WHEN the harness returns only the absent keys THEN returns the validated fill', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

      const enrich = aiMissingFixture(options);
      const result = await enrich('invoice', request);

      expect(result).toStrictEqual(FILLED);
    });

    it('WHEN the harness answers THEN the prompt carries the pruned document and the corrupt baseline', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

      const enrich = aiMissingFixture(options);

      await enrich('invoice', request);

      const prompt = agentPrompt();
      const document = missingDocument(missing);

      expect(prompt['baseline']).toStrictEqual(CORRUPT);
      expect(prompt['missing']).toStrictEqual(document);
      expect(prompt['scenario']).toBe(SCENARIO);
    });

    it('WHEN the harness answers THEN the prompt never carries the full specification', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', JSON.stringify(FILLED)));

      const enrich = aiMissingFixture(options);

      await enrich('invoice', request);

      const keys = Object.keys(agentPrompt()).toSorted();

      expect(keys).toStrictEqual(['baseline', 'instructions', 'missing', 'scenario']);
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

    it('WHEN a required missing key is absent THEN rejects rather than returning a partial fill', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', '{}'));

      const enrich = aiMissingFixture(options);

      await expect(enrich('invoice', request)).rejects.toThrow(/generated missing fields violate schema "missing"/);
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
