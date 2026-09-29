import { describe, expect, it } from 'vitest';

import { minifiedSchemaProse, minifiedStrings } from './prompt-minify.util.ts';

const SPACED = '  a \n  b  ';
const LINES = [{ note: SPACED, qty: 2 }, SPACED, null];
const BASELINE = { memo: SPACED, 'key  with  spaces': true, lines: LINES };
const TAG = { type: 'string', title: SPACED, description: SPACED, pattern: '^a  b\\s+$', format: 'date  time' };
const EXAMPLE = { description: SPACED };
const DATA_PROPERTY = {
  type: 'string',
  enum: [SPACED],
  const: SPACED,
  default: SPACED,
  example: EXAMPLE,
  examples: [SPACED]
};
const NAMED_PROPERTY = { type: 'object', description: 7 };
const PROPERTIES = { tag: TAG, data: DATA_PROPERTY, description: NAMED_PROPERTY };
const SCHEMA = { type: 'object', required: ['tag'], properties: PROPERTIES, allOf: [TAG] };
const MINIFIED_LINE = { note: 'a b', qty: 2 };
const MINIFIED_BASELINE = { memo: 'a b', 'key  with  spaces': true, lines: [MINIFIED_LINE, 'a b', null] };
const MINIFIED_PROSE = { title: 'a b', description: 'a b' };
const KEPT_STRINGS = { pattern: '^a  b\\s+$', format: 'date  time' };

describe('FEATURE: prompt minification', (): void => {
  describe('GIVEN a baseline fixture with padded strings', (): void => {
    it('WHEN minified THEN every string value collapses and trims', (): void => {
      const minified = minifiedStrings(BASELINE);

      expect(minified).toStrictEqual(MINIFIED_BASELINE);
    });

    it('WHEN minified THEN the input is not mutated', (): void => {
      const baseline = structuredClone(BASELINE);

      minifiedStrings(baseline);

      expect(baseline).toStrictEqual(BASELINE);
    });
  });

  describe('GIVEN a schema with padded prose and data keywords', (): void => {
    it('WHEN minified THEN title and description collapse, also inside arrays', (): void => {
      const minified = minifiedSchemaProse(SCHEMA);

      expect(minified).toHaveProperty('properties.tag', expect.objectContaining(MINIFIED_PROSE));
      expect(minified).toHaveProperty('allOf.0', expect.objectContaining(MINIFIED_PROSE));
    });

    it('WHEN minified THEN pattern and format stay as written', (): void => {
      const minified = minifiedSchemaProse(SCHEMA);

      expect(minified).toHaveProperty('properties.tag', expect.objectContaining(KEPT_STRINGS));
    });

    it('WHEN minified THEN enum, const, default, example and examples are untouched', (): void => {
      const minified = minifiedSchemaProse(SCHEMA);

      expect(minified).toHaveProperty('properties.data', DATA_PROPERTY);
    });

    it('WHEN a property is named description THEN its schema is walked, not collapsed', (): void => {
      const minified = minifiedSchemaProse(SCHEMA);

      expect(minified).toHaveProperty('properties.description', NAMED_PROPERTY);
    });
  });
});
