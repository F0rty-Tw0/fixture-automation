import { describe, expect, it } from 'vitest';

import { missingPrompt } from './fixture-prompt.util.ts';
import { missingDocument } from './missing-document.util.ts';
import { isSchemaRecord } from './schema-record.util.ts';
import type { MissingFile, MissingPromptInput } from '../common/missing.type.ts';

const FIXTURE_JSON = '{"id":"in_base","amount_due":0}';
const STATUS_SCHEMA = { type: 'string' };
const PROPERTIES = { status: STATUS_SCHEMA };
const PROJECTION = { type: 'object', required: ['status'], properties: PROPERTIES };
const SCHEMAS = { missing: PROJECTION };
const COMPONENTS = { schemas: SCHEMAS };
const DOCUMENT = { $ref: '#/components/schemas/missing', components: COMPONENTS };
const SCENARIO = 'Fill the absent status.';
const RESPONSE_RULE =
  'Return exactly one JSON value that conforms to the `missing` schema. Include only its keys. Keep values coherent with `baseline` (currency, ids, totals).';
const OVERSIZE_RULE =
  'missing prompt exceeds the 1 MiB agent input limit; drop fewer or leaf-only fields (schemas referencing hub objects such as account pull in the whole graph)';
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const EMPTY_COMPONENTS = { schemas: EMPTY_SCHEMAS };

/** A projection whose descriptions alone push the serialized prompt past the agent input limit. */
const sizedDocument = (descriptionLength: number): unknown => {
  const description = 'x'.repeat(descriptionLength);
  const property = { type: 'string', description };
  const properties = { note: property };
  const schema = { type: 'object', required: ['note'], properties };
  const file: MissingFile = {
    schemaName: 'invoice',
    dialect: 'openapi-30',
    paths: ['note'],
    schema,
    components: EMPTY_COMPONENTS
  };

  return missingDocument(file);
};

const promptInput = (missing: unknown): MissingPromptInput => {
  const input: MissingPromptInput = { fixtureJson: FIXTURE_JSON, missing, scenario: SCENARIO };

  return input;
};

const parsedPrompt = (): Record<string, unknown> => {
  const text = missingPrompt(promptInput(DOCUMENT));
  const parsed: unknown = JSON.parse(text);

  if (!isSchemaRecord(parsed)) throw new Error('the prompt payload is not a JSON object');

  return parsed;
};

describe('FEATURE: missing-field prompt payload', (): void => {
  describe('GIVEN a baseline fixture and a pruned missing document', (): void => {
    it('WHEN building the prompt THEN carries the baseline, missing document, and scenario', (): void => {
      const prompt = parsedPrompt();
      const baseline: unknown = JSON.parse(FIXTURE_JSON);

      expect(prompt['baseline']).toStrictEqual(baseline);
      expect(prompt['missing']).toStrictEqual(DOCUMENT);
      expect(prompt['scenario']).toBe(SCENARIO);
    });

    it('WHEN building the prompt THEN omits the full prepared specification', (): void => {
      const prompt = parsedPrompt();
      const keys = Object.keys(prompt).toSorted();

      expect(keys).toStrictEqual(['baseline', 'instructions', 'missing', 'scenario']);
    });

    it('WHEN building the prompt THEN restricts the reply to the projection keys', (): void => {
      const prompt = parsedPrompt();
      const instructions: unknown = prompt['instructions'];

      expect(instructions).toStrictEqual({
        authority: 'The schema is authoritative. The result must conform to it even when the scenario or baseline conflicts.',
        response: RESPONSE_RULE,
        restrictions: 'Do not access tools, code, project files, or external resources.'
      });
    });

    it('WHEN serializing the prompt THEN emits one JSON line without markdown', (): void => {
      const text = missingPrompt(promptInput(DOCUMENT));
      const hasNewline = text.includes('\n');

      expect(hasNewline).toBe(false);
      expect(text.startsWith('{')).toBe(true);
    });

    it('WHEN the projection serializes past 1 MiB THEN rejects before the harness sees it', (): void => {
      const input = promptInput(sizedDocument(1024 * 1024));

      expect((): unknown => missingPrompt(input)).toThrow(OVERSIZE_RULE);
    });

    it('WHEN a large projection still fits THEN returns the payload rather than rejecting', (): void => {
      const text = missingPrompt(promptInput(sizedDocument(1000)));

      expect(text.length).toBeGreaterThan(1000);
    });
  });
});
