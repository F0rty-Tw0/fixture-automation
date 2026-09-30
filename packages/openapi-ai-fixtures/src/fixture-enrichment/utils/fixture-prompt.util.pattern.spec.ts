import { describe, expect, it } from 'vitest';

import { patternPrompt, patternPromptBytes } from './fixture-prompt.util.ts';
import type { PatternPromptInput } from '../../missing-patterns/common/missing-pattern.type.ts';
import { missingPatterns } from '../../missing-patterns/utils/path-pattern.util.ts';
import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';

const MISSING_FIELDS = ['qty', 'sku', 'tax', 'unit', 'note', 'discount'];
const LINE_COUNT = 1000;
const SCENARIO = 'Fill the absent line fields.';
const PADDED_NOTE = { type: 'string', description: '  Free \n text  ', pattern: '^a  b$' };
const LINE_PROPERTIES = { note: PADDED_NOTE };
const LINE_ITEM = { type: 'object', properties: LINE_PROPERTIES };
const LINES_SCHEMA = { type: 'array', items: LINE_ITEM };
const PROJECTION_PROPERTIES = { lines: LINES_SCHEMA };
const PROJECTION = { type: 'object', properties: PROJECTION_PROPERTIES };
const MINIFIED_NOTE = { type: 'string', description: 'Free text', pattern: '^a  b$' };
const AUTHORITY_RULE = 'The schema is authoritative. The result must conform to it even when the scenario or baseline conflicts.';
const RESTRICTIONS_RULE = 'Do not access tools, code, project files, or external resources.';
const FILE_RESTRICTIONS_RULE =
  '`files.baseline` is the complete baseline fixture as JSON in your working directory; `digest` is its trimmed view. You may read and search only the files listed in `files`: search first, then read only the line ranges you need (offset/limit), never the whole file. Do not write files, run commands, or access the network or any other file.';
const OVERSIZE_RULE =
  'missing prompt exceeds the 1 MiB agent input limit; drop fewer or leaf-only fields (schemas referencing hub objects such as account pull in the whole graph)';
const PATTERN_RESPONSE_RULE =
  'Return exactly one JSON object with one key per entry of `patterns`, and no other keys. Each value is an array of 1 to K example values, where K is the smaller of that pattern\'s `count` and 5; every example is the whole value at that path and must conform to the `missing` schema there (an array-valued path takes arrays as examples). `[*]` stands for every array index. Examples are reused cyclically across the pattern\'s items: the i-th item gets example i mod K. Inside string values, `{n}` is replaced by the item\'s 1-based position among that pattern\'s paths, not its array index. Every string example of a field that should differ per item (ids, SKUs, codes, references, emails, names) must contain `{n}`: answer ["SKU-{n}"], never literal sequences such as ["SKU-00001", "SKU-00002"], which repeat across the items. Every other field gets K different realistic examples (varied quantities, amounts, enum values, descriptions), so the items do not all look alike. Keep values coherent with `digest` (currency, ids, totals), the baseline trimmed to the patterns\' parents with every array cut to its first 3 elements.';

/** An invoice whose `lineCount` lines carry padded memos, and the paths of the six fields every line lacks. */
const invoiceInput = (lineCount: number, missing: unknown): PatternPromptInput => {
  const lineAt = (_value: unknown, index: number): unknown => {
    const line = { id: `line_${index}`, memo: `  Line \n ${index}  ` };

    return line;
  };
  const lines = Array.from({ length: lineCount }, lineAt);
  const fixture = { id: 'in_1', currency: 'usd', lines };
  const linePaths = (_value: unknown, index: number): string[] =>
    MISSING_FIELDS.map((field: string): string => `lines[${index}].${field}`);
  const paths = Array.from({ length: lineCount }, linePaths).flat();
  const patterns = missingPatterns(paths);
  const input: PatternPromptInput = { fixture, missing, patterns, scenario: SCENARIO };

  return input;
};

const parsedPrompt = (input: PatternPromptInput): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(patternPrompt(input));

  if (!isSchemaRecord(parsed)) throw new Error('the prompt payload is not a JSON object');

  return parsed;
};

describe('FEATURE: pattern prompt payload', (): void => {
  describe('GIVEN an invoice whose 1000 lines each lack 6 fields', (): void => {
    it('WHEN building the prompt THEN it carries instructions, the missing document, patterns, a digest, and the scenario', (): void => {
      const prompt = parsedPrompt(invoiceInput(LINE_COUNT, PROJECTION));

      expect(Object.keys(prompt)).toStrictEqual(['instructions', 'missing', 'patterns', 'digest', 'scenario']);
    });

    it('WHEN building the prompt THEN lists each pattern once with its path count', (): void => {
      const patternCount = (field: string): unknown => {
        const count = { pattern: `lines[*].${field}`, count: LINE_COUNT };

        return count;
      };
      const expected = MISSING_FIELDS.map(patternCount);

      const prompt = parsedPrompt(invoiceInput(LINE_COUNT, PROJECTION));

      expect(prompt['patterns']).toStrictEqual(expected);
    });

    it('WHEN building the prompt THEN the digest holds the first 3 lines with minified strings instead of the full baseline', (): void => {
      const lines = [
        { id: 'line_0', memo: 'Line 0' },
        { id: 'line_1', memo: 'Line 1' },
        { id: 'line_2', memo: 'Line 2' }
      ];

      const prompt = parsedPrompt(invoiceInput(LINE_COUNT, PROJECTION));

      expect(prompt['digest']).toStrictEqual({ id: 'in_1', currency: 'usd', lines });
    });

    it('WHEN building the prompt THEN schema prose collapses while the `pattern` keyword stays exact', (): void => {
      const prompt = parsedPrompt(invoiceInput(LINE_COUNT, PROJECTION));

      expect(prompt['missing']).toHaveProperty('properties.lines.items.properties.note', MINIFIED_NOTE);
    });

    it('WHEN building the prompt THEN asks for examples per pattern', (): void => {
      const expected = { authority: AUTHORITY_RULE, response: PATTERN_RESPONSE_RULE, restrictions: RESTRICTIONS_RULE };

      const prompt = parsedPrompt(invoiceInput(LINE_COUNT, PROJECTION));

      expect(prompt['instructions']).toStrictEqual(expected);
    });

    it('WHEN measured THEN the 6000 paths yield 6 patterns and stay far under the agent input limit', (): void => {
      const input = invoiceInput(LINE_COUNT, PROJECTION);

      const bytes = patternPromptBytes(input);

      expect(input.patterns).toHaveLength(6);
      expect(bytes).toBeLessThan(64 * 1024);
    });

    it('WHEN measured THEN the size equals the built prompt in UTF-8 bytes', (): void => {
      const input = invoiceInput(LINE_COUNT, PROJECTION);

      const bytes = patternPromptBytes(input);

      expect(bytes).toBe(Buffer.byteLength(patternPrompt(input), 'utf8'));
    });
  });

  describe('GIVEN an invoice staged as a baseline file', (): void => {
    const staged = (): PatternPromptInput => {
      const invoice = invoiceInput(LINE_COUNT, PROJECTION);
      const input: PatternPromptInput = { ...invoice, baselineFile: 'baseline.json' };

      return input;
    };

    it('WHEN building the prompt THEN lists the file between the digest and the scenario', (): void => {
      const prompt = parsedPrompt(staged());

      expect(Object.keys(prompt)).toStrictEqual(['instructions', 'missing', 'patterns', 'digest', 'files', 'scenario']);
    });

    it('WHEN building the prompt THEN names the staged baseline', (): void => {
      const prompt = parsedPrompt(staged());

      expect(prompt['files']).toStrictEqual({ baseline: 'baseline.json' });
    });

    it('WHEN building the prompt THEN allows reading only the listed files', (): void => {
      const prompt = parsedPrompt(staged());

      expect(prompt['instructions']).toHaveProperty('restrictions', FILE_RESTRICTIONS_RULE);
    });
  });

  describe('GIVEN a missing document past 1 MiB', (): void => {
    const oversized = { type: 'string', description: 'x'.repeat(1024 * 1024) };

    it('WHEN building the prompt THEN rejects before the harness sees it', (): void => {
      const input = invoiceInput(1, oversized);

      expect((): unknown => patternPrompt(input)).toThrow(OVERSIZE_RULE);
    });

    it('WHEN measured THEN the size is reported without throwing', (): void => {
      const input = invoiceInput(1, oversized);

      const bytes = patternPromptBytes(input);

      expect(bytes).toBeGreaterThan(1024 * 1024);
    });
  });
});
