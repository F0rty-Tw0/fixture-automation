import { describe, expect, it } from 'vitest';

import { selectFixtureShape } from './fixture-shape.util.ts';

describe('FEATURE: fixture shape selection', (): void => {
  describe('GIVEN a fixture with an envelope', (): void => {
    const body = { id: 'in_1' };
    const fixture = { statusCode: 200, body };

    it('WHEN body is selected THEN only its payload is returned', (): void => {
      const selected = selectFixtureShape(fixture, 'body');

      expect(selected).toStrictEqual(body);
    });

    it('WHEN no shape is selected THEN the envelope remains the comparison value', (): void => {
      const selected = selectFixtureShape(fixture, undefined);

      expect(selected).toStrictEqual(fixture);
    });
  });

  describe('GIVEN a key not owned by the fixture', (): void => {
    it('WHEN selecting an inherited key THEN selection fails rather than returning a prototype value', (): void => {
      expect((): unknown => selectFixtureShape({}, 'toString')).toThrow();
    });
  });

  describe('GIVEN a null fixture', (): void => {
    it('WHEN selecting body THEN selection fails rather than comparing the root', (): void => {
      expect((): unknown => selectFixtureShape(null, 'body')).toThrow();
    });
  });
});
