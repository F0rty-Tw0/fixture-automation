import { describe, expect, it } from 'vitest';

import { parseSpec } from './openapi-spec.util.ts';

describe('FEATURE: OpenAPI JSON parsing', (): void => {
  describe('GIVEN a JSON specification object', (): void => {
    it('WHEN parsed THEN preserves its schema definitions', (): void => {
      const components = { schemas: {} };
      const expected = { components };

      const spec = parseSpec('{"components":{"schemas":{}}}', 'file:///spec.json');

      expect(spec).toStrictEqual(expected);
    });
  });

  describe.each(['null', '42', '{}', '{"components":{}}'])('GIVEN the JSON value %s', (text): void => {
    it('WHEN parsed THEN reports the absent components.schemas', (): void => {
      expect((): unknown => parseSpec(text, 'file:///spec.json')).toThrow('spec at file:///spec.json has no components.schemas');
    });
  });

  describe('GIVEN malformed JSON', (): void => {
    it('WHEN parsed THEN names the spec alongside the parser message', (): void => {
      expect((): unknown => parseSpec('{', 'file:///spec.json')).toThrow('spec at file:///spec.json is not JSON:');
    });
  });

  describe('GIVEN a YAML URL whose body opens with a document marker', (): void => {
    it('WHEN parsed THEN says the loader reads JSON only', (): void => {
      const text = '---\ninfo:\n  title: Fixture API\n';

      expect((): unknown => parseSpec(text, new URL('file:///spec.yaml'))).toThrow('is YAML; this loader reads JSON only');
    });
  });

  describe('GIVEN a YAML document', (): void => {
    it('WHEN parsed THEN says the loader reads JSON only', (): void => {
      const text = 'openapi: 3.0.0\ncomponents:\n  schemas: {}\n';

      expect((): unknown => parseSpec(text, 'file:///spec.yaml')).toThrow(
        'spec at file:///spec.yaml is YAML; this loader reads JSON only'
      );
    });
  });
});
