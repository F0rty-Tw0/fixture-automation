import { describe, expect, it } from 'vitest';

import { referenceName, unresolvedReferenceFix } from './schema-reference.util.ts';

describe('FEATURE: schema reference decoding', (): void => {
  describe('GIVEN a component pointer', (): void => {
    it('WHEN decoded THEN returns the component name', (): void => {
      expect(referenceName('#/components/schemas/invoice')).toBe('invoice');
    });

    it('WHEN the name holds JSON pointer escapes THEN unescapes ~1 to / and ~0 to ~', (): void => {
      expect(referenceName('#/components/schemas/a~1b~0c')).toBe('a/b~c');
    });

    it('WHEN the name is percent-encoded THEN decodes it before unescaping', (): void => {
      expect(referenceName('#/components/schemas/in%20voice~1v1')).toBe('in voice/v1');
    });
  });

  describe('GIVEN a pointer outside components.schemas', (): void => {
    it('WHEN decoded THEN throws naming the reference', (): void => {
      expect((): string => referenceName('#/definitions/invoice')).toThrow(
        'unsupported local schema reference "#/definitions/invoice"'
      );
    });

    it('WHEN decoded THEN the error is a FixtureError whose fix points at components.schemas', (): void => {
      const expected = { fix: 'point the $ref at #/components/schemas/<name>' };

      expect((): string => referenceName('#/definitions/invoice')).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN a malformed percent escape', (): void => {
    it('WHEN decoded THEN throws naming the reference', (): void => {
      expect((): string => referenceName('#/components/schemas/%E0%A4%A')).toThrow(
        'invalid schema reference "#/components/schemas/%E0%A4%A"'
      );
    });

    it('WHEN decoded THEN the error is a FixtureError whose fix names the bad escape', (): void => {
      const expected = { fix: 'fix the percent escape in the $ref' };

      expect((): string => referenceName('#/components/schemas/%E0%A4%A')).toThrow(expect.objectContaining(expected));
    });
  });

  describe('GIVEN a component name the spec lacks', (): void => {
    it('WHEN asked for a fix THEN names the component to add', (): void => {
      expect(unresolvedReferenceFix('ghost')).toBe(
        'add components.schemas["ghost"] to the spec, or point the $ref at an existing schema'
      );
    });
  });
});
