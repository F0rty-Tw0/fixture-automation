import { describe, expect, it } from 'vitest';

import { fixturePrompt, missingPrompt, missingPromptBytes } from './fixture-prompt.util.ts';
import type { MissingFile, MissingPromptInput } from '../../missing-values/common/missing.type.ts';
import { missingDocument } from '../../missing-values/utils/missing-document.util.ts';
import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';

const FIXTURE_JSON = '{"id":"in_base","amount_due":0}';
const STATUS_SCHEMA = { type: 'string' };
const PROPERTIES = { status: STATUS_SCHEMA };
const PROJECTION = { type: 'object', required: ['status'], properties: PROPERTIES };
const SCHEMAS = { missing: PROJECTION };
const COMPONENTS = { schemas: SCHEMAS };
const DOCUMENT = { $ref: '#/components/schemas/missing', components: COMPONENTS };
const SCENARIO = 'Fill the absent status.';
const SCHEMA_JSON = '{"type":"object","required":["status"],"properties":{"status":{"type":"string","enum":["open","paid"]}}}';
const BASELINE_RULE =
  'Use the baseline fixture as an editable starting point; its values are not immutable. Return the complete fixture: keep every baseline key the schema allows, populate every key the schema requires but the baseline lacks, and correct any value whose type or enum casing does not match the schema. Every array must keep exactly its baseline length, edited index by index; never add, drop, or reorder elements.';
const RESPONSE_RULE =
  'Return exactly one JSON value that conforms to the `missing` schema. Include only its keys. Keep values coherent with `baseline` (currency, ids, totals). The result is merged into `baseline` index by index, so every array that also exists in `baseline` must have exactly the baseline array length.';
const OVERSIZE_RULE =
  'missing prompt exceeds the 1 MiB agent input limit; drop fewer or leaf-only fields (schemas referencing hub objects such as account pull in the whole graph)';
const PADDED_FIXTURE_JSON = '{"memo":"  Net \\n  30  ","id":"in_1"}';
const PADDED_NOTE = { type: 'string', description: '  Free \n text  ', pattern: '^a  b$', enum: ['  x  '] };
const PADDED_PROPERTIES = { note: PADDED_NOTE };
const PADDED_PROJECTION = { type: 'object', title: ' Missing   fields ', properties: PADDED_PROPERTIES };
const MINIFIED_NOTE = { type: 'string', description: 'Free text', pattern: '^a  b$', enum: ['  x  '] };
const MINIFIED_BASELINE = { memo: 'Net 30', id: 'in_1' };
const PADDED_SCHEMA_JSON = '{"type":"object","description":"  An   invoice ","properties":{"memo":{"type":"string"}}}';
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

  describe('GIVEN padded baseline strings and schema prose', (): void => {
    const paddedPrompt = (): Record<string, unknown> => {
      const input: MissingPromptInput = { fixtureJson: PADDED_FIXTURE_JSON, missing: PADDED_PROJECTION, scenario: SCENARIO };
      const parsed: unknown = JSON.parse(missingPrompt(input));

      if (!isSchemaRecord(parsed)) throw new Error('the prompt payload is not a JSON object');

      return parsed;
    };

    it('WHEN building the prompt THEN baseline strings are collapsed and trimmed', (): void => {
      const prompt = paddedPrompt();

      expect(prompt['baseline']).toStrictEqual(MINIFIED_BASELINE);
    });

    it('WHEN building the prompt THEN title and description collapse while pattern and enum stay exact', (): void => {
      const prompt = paddedPrompt();

      expect(prompt['missing']).toHaveProperty('title', 'Missing fields');
      expect(prompt['missing']).toHaveProperty('properties.note', MINIFIED_NOTE);
    });
  });

  describe('GIVEN a prompt measured before it is built', (): void => {
    it('WHEN it fits THEN the size equals the built prompt in UTF-8 bytes', (): void => {
      const input = promptInput(DOCUMENT);

      const bytes = missingPromptBytes(input);

      expect(bytes).toBe(Buffer.byteLength(missingPrompt(input), 'utf8'));
    });

    it('WHEN it exceeds 1 MiB THEN the size is reported without throwing', (): void => {
      const input = promptInput(sizedDocument(1024 * 1024));

      const bytes = missingPromptBytes(input);

      expect(bytes).toBeGreaterThan(1024 * 1024);
    });
  });
});

describe('FEATURE: full fixture prompt payload', (): void => {
  describe('GIVEN a schema, baseline fixture, and scenario', (): void => {
    it('WHEN building the prompt THEN instructs the agent to fill gaps, fix type/enum casing, and keep array lengths', (): void => {
      const text = fixturePrompt(SCHEMA_JSON, FIXTURE_JSON, SCENARIO);
      const parsed: unknown = JSON.parse(text);

      if (!isSchemaRecord(parsed)) throw new Error('the prompt payload is not a JSON object');

      const instructions: unknown = parsed['instructions'];

      expect(instructions).toStrictEqual({
        authority: 'The schema is authoritative. The result must conform to it even when the scenario or baseline conflicts.',
        baseline: BASELINE_RULE,
        response: 'Return exactly one JSON value with no markdown or explanatory text.',
        restrictions: 'Do not access tools, code, project files, or external resources.'
      });
    });

    it('WHEN the schema prose is padded THEN it collapses while baseline strings stay exact', (): void => {
      const text = fixturePrompt(PADDED_SCHEMA_JSON, PADDED_FIXTURE_JSON, SCENARIO);
      const parsed: unknown = JSON.parse(text);

      expect(parsed).toHaveProperty('schema.description', 'An invoice');
      expect(parsed).toHaveProperty('baseline.memo', '  Net \n  30  ');
    });
  });
});
