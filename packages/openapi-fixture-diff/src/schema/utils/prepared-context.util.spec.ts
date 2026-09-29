import { describe, expect, it } from 'vitest';

import { contextComponents } from './prepared-context.util.ts';

const ORDER_SCHEMA = { type: 'object' };
const SCHEMAS = { order: ORDER_SCHEMA };
const COMPONENTS = { schemas: SCHEMAS };
const EMPTY_COMPONENTS = { schemas: {} };
const RESPONSE_COMPONENTS = { responses: {} };
const LISTED_COMPONENTS = { schemas: [] };

describe('FEATURE: prepared schema context components', (): void => {
  describe('GIVEN a context document carrying components.schemas', (): void => {
    it('WHEN reading the components THEN the schemas are returned as given', (): void => {
      const context = JSON.stringify({ openapi: '3.1.0', components: COMPONENTS });

      const components = contextComponents(context);

      expect(components).toStrictEqual(COMPONENTS);
    });
  });

  describe('GIVEN a context document with empty schemas', (): void => {
    it('WHEN reading the components THEN the schemas are empty', (): void => {
      const context = JSON.stringify({ components: EMPTY_COMPONENTS });

      const components = contextComponents(context);

      expect(components.schemas).toStrictEqual({});
    });
  });

  describe('GIVEN a context document that is a JSON array', (): void => {
    it('WHEN reading the components THEN it fails because the context must be an object', (): void => {
      const context = JSON.stringify([COMPONENTS]);

      expect((): unknown => contextComponents(context)).toThrow('the prepared schema context must be an object');
    });
  });

  describe('GIVEN a context document without components', (): void => {
    it('WHEN reading the components THEN it fails because components.schemas is required', (): void => {
      const context = JSON.stringify({ openapi: '3.1.0' });

      expect((): unknown => contextComponents(context)).toThrow('the prepared schema context must carry components.schemas');
    });
  });

  describe('GIVEN a context document whose components lack schemas', (): void => {
    it('WHEN reading the components THEN it fails because components.schemas is required', (): void => {
      const context = JSON.stringify({ components: RESPONSE_COMPONENTS });

      expect((): unknown => contextComponents(context)).toThrow('the prepared schema context must carry components.schemas');
    });
  });

  describe('GIVEN a context document whose schemas is an array', (): void => {
    it('WHEN reading the components THEN it fails because components.schemas is required', (): void => {
      const context = JSON.stringify({ components: LISTED_COMPONENTS });

      expect((): unknown => contextComponents(context)).toThrow('the prepared schema context must carry components.schemas');
    });
  });
});
