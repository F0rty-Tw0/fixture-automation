import { describe, expect, it } from 'vitest';

import { patternRequest } from './pattern-request.util.ts';
import type { PatternPromptInput } from '../../missing-patterns/common/missing-pattern.type.ts';
import { missingPatterns } from '../../missing-patterns/utils/path-pattern.util.ts';
import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

const STRING_SCHEMA = { type: 'string' };
const CUSTOMER_PROPERTIES = { email: STRING_SCHEMA };
const CUSTOMER_SCHEMA = { type: 'object', properties: CUSTOMER_PROPERTIES };
const PROJECTION_PROPERTIES = { customer: CUSTOMER_SCHEMA };
const PROJECTION = { type: 'object', properties: PROJECTION_PROPERTIES };
const CUSTOMER = { name: 'Ana' };
const FIXTURE = { id: 'in_1', customer: CUSTOMER };
const INDENTED_FIXTURE_JSON = JSON.stringify(FIXTURE, null, 2);
const PATTERNS = missingPatterns(['customer.email']);
const INPUT: PatternPromptInput = { fixture: FIXTURE, missing: PROJECTION, patterns: PATTERNS, scenario: 'Fill the email.' };

const promptKeys = (prompt: string): string[] => {
  const parsed: unknown = JSON.parse(prompt);

  if (!isSchemaRecord(parsed)) throw new Error('the prompt payload is not a JSON object');

  return Object.keys(parsed);
};

describe('FEATURE: pattern agent request', (): void => {
  describe('GIVEN a tool in file mode', (): void => {
    const options: AiFixtureOptions = { tool: 'claude' };

    it('WHEN the request is built THEN stages the fixture as indented JSON in baseline.json', (): void => {
      const request = patternRequest(INPUT, options);

      expect(request.files).toStrictEqual([{ path: 'baseline.json', content: INDENTED_FIXTURE_JSON }]);
    });

    it('WHEN the request is built THEN the prompt lists the staged file', (): void => {
      const request = patternRequest(INPUT, options);

      expect(promptKeys(request.prompt)).toContain('files');
    });
  });

  describe('GIVEN a tool without file mode', (): void => {
    const options: AiFixtureOptions = { tool: 'codex' };

    it('WHEN the request is built THEN stages nothing', (): void => {
      const request = patternRequest(INPUT, options);

      expect(request).not.toHaveProperty('files');
    });

    it('WHEN the request is built THEN the prompt lists no files', (): void => {
      const request = patternRequest(INPUT, options);

      expect(promptKeys(request.prompt)).not.toContain('files');
    });
  });
});
