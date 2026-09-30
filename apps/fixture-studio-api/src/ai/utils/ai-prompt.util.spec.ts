import { MISSING_PROMPT_LIMIT_BYTES, MISSING_SCENARIO } from '@fixture-automation/openapi-ai-fixtures';
import { isRecord } from '@fixture-automation/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { aiPrompt, missingScenario, trimmedPromptBytes } from './ai-prompt.util.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture } from '../../test/utils/studio-spec.spec.util.ts';

const FIXTURE = { id: 'in_9' };
const HUGE_FIXTURE = { id: 'in_9', memo: 'm'.repeat(MISSING_PROMPT_LIMIT_BYTES) };
const NOTES = Array.from({ length: 400 }, (_value: unknown, index: number): string => `note ${index}`);
const HISTORY = { notes: NOTES };
const ADDRESS = { city: 'Oslo' };
const CUSTOMER = { name: 'Ada', address: ADDRESS };
const META = { x: 1 };
const LINES = [{ quantity: 1 }, { sku: 'b', quantity: 2 }, { sku: 'c', meta: META }];
const LINES_FIXTURE = { currency: 'usd', customer: CUSTOMER, lines: LINES, history: HISTORY };
const TRIMMED_LINES = [{ quantity: 1 }, { sku: 'b', quantity: 2 }, { sku: 'c' }];
const TRIMMED_BASELINE = { currency: 'usd', lines: TRIMMED_LINES };
const REQUIRED_LINES = { required: ['lines'] };
const CHUNK_SCHEMAS = { missing: REQUIRED_LINES };
const CHUNK_COMPONENTS = { schemas: CHUNK_SCHEMAS };
const CHUNK_DOCUMENT = { components: CHUNK_COMPONENTS };
const CHUNK_PAYLOAD = { missing: CHUNK_DOCUMENT };
const EMPTY_PAYLOAD: Record<string, unknown> = {};

const promptPayload = (prompt: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(prompt);

  if (!isRecord(parsed)) return EMPTY_PAYLOAD;

  return parsed;
};

describe('FEATURE: AI prompt', (): void => {
  let missing: MissingFile;

  beforeAll(async (): Promise<void> => {
    missing = await missingFixture('status');
  });

  describe('SCENARIO: scenario text', (): void => {
    describe('GIVEN a scenario value', (): void => {
      it.each<[string, string | undefined, string]>([
        ['absent', undefined, MISSING_SCENARIO],
        ['blank', '   ', MISSING_SCENARIO],
        ['padded', '  an overdue invoice  ', 'an overdue invoice']
      ])('WHEN it is %s THEN resolves to %s', (_label: string, scenario: string | undefined, expected: string): void => {
        const text = missingScenario(scenario);

        expect(text).toBe(expected);
      });
    });
  });

  describe('SCENARIO: prompt', (): void => {
    describe('GIVEN a fixture and its missing projection', (): void => {
      it('WHEN built THEN the prompt carries the baseline, the missing document and the scenario', (): void => {
        const result = aiPrompt(FIXTURE, missing, 'an overdue invoice');

        const payload = promptPayload(result.prompt);

        expect(payload).toMatchObject({ baseline: FIXTURE, scenario: 'an overdue invoice' });
        expect(payload['missing']).toMatchObject({ $ref: '#/components/schemas/missing' });
        expect(result.system).toContain('JSON');
      });

      it('WHEN built THEN the response schema is the projection with bundled $defs', (): void => {
        const result = aiPrompt(FIXTURE, missing, undefined);

        expect(result.responseSchema).toMatchObject({ type: 'object', required: ['status'], $defs: {} });
      });
    });

    describe('GIVEN a fixture JSON cannot print', (): void => {
      it('WHEN built THEN fails with a fix', (): void => {
        expect((): unknown => aiPrompt(undefined, missing, undefined)).toThrow('the fixture is not JSON-serializable');
      });
    });
  });

  describe('SCENARIO: prompt for a chunk of paths', (): void => {
    let linesMissing: MissingFile;

    beforeAll(async (): Promise<void> => {
      linesMissing = await missingFixture('lines');
    });

    describe('GIVEN a fixture with a large subtree off every missing path', (): void => {
      it('WHEN built for one path THEN the missing schema requires only that path', (): void => {
        const result = aiPrompt(LINES_FIXTURE, linesMissing, undefined, ['lines[1].tax']);

        const payload = promptPayload(result.prompt);

        expect(payload).toMatchObject(CHUNK_PAYLOAD);
        expect(result.responseSchema).toMatchObject(REQUIRED_LINES);
      });

      it('WHEN built for one path THEN the baseline keeps only its context', (): void => {
        const result = aiPrompt(LINES_FIXTURE, linesMissing, undefined, ['lines[1].tax']);

        const payload = promptPayload(result.prompt);

        expect(payload['baseline']).toStrictEqual(TRIMMED_BASELINE);
      });

      it('WHEN built for one path THEN the prompt is a fraction of the full one', (): void => {
        const full = aiPrompt(LINES_FIXTURE, linesMissing, undefined);

        const chunk = aiPrompt(LINES_FIXTURE, linesMissing, undefined, ['lines[1].tax']);

        expect(chunk.prompt.length).toBeLessThan(full.prompt.length / 4);
      });

      it('WHEN built without paths THEN the baseline is the whole fixture', (): void => {
        const result = aiPrompt(LINES_FIXTURE, linesMissing, undefined);

        const payload = promptPayload(result.prompt);

        expect(payload['baseline']).toStrictEqual(LINES_FIXTURE);
      });
    });
  });

  describe('SCENARIO: trimmed prompt size', (): void => {
    describe('GIVEN a large subtree off every missing path', (): void => {
      it('WHEN measured THEN counts the prompt trimmed to all of them', (): void => {
        const trimmed = aiPrompt(LINES_FIXTURE, missing, undefined, missing.paths);
        const expected = Buffer.byteLength(trimmed.prompt, 'utf8');

        const bytes = trimmedPromptBytes(LINES_FIXTURE, missing);

        expect(bytes).toBe(expected);
      });

      it('WHEN measured THEN is a fraction of the whole-fixture prompt', (): void => {
        const wholePrompt = aiPrompt(LINES_FIXTURE, missing, undefined);
        const whole = Buffer.byteLength(wholePrompt.prompt, 'utf8');

        const bytes = trimmedPromptBytes(LINES_FIXTURE, missing);

        expect(bytes).toBeLessThan(whole / 4);
      });
    });

    it('GIVEN nothing missing WHEN measured THEN is 0', (): void => {
      const none: MissingFile = { ...missing, paths: [] };

      const bytes = trimmedPromptBytes(FIXTURE, none);

      expect(bytes).toBe(0);
    });

    it('GIVEN a root string over the agent input limit WHEN measured THEN counts past the limit without failing', (): void => {
      const bytes = trimmedPromptBytes(HUGE_FIXTURE, missing);

      expect(bytes).toBeGreaterThan(MISSING_PROMPT_LIMIT_BYTES);
    });
  });
});
