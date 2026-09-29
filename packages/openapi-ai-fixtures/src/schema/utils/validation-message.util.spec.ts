import type { ErrorObject } from 'ajv';
import { describe, expect, it } from 'vitest';

import { validationDetails } from './validation-message.util.ts';

const REQUIRED_PARAMS = { missingProperty: 'id' };
const TYPE_PARAMS = { type: 'string' };
const MINIMUM_PARAMS = { comparison: '>=', limit: 0 };
const REQUIRED_ERROR: ErrorObject = {
  instancePath: '',
  keyword: 'required',
  message: "must have required property 'id'",
  params: REQUIRED_PARAMS,
  schemaPath: '#/required'
};
const TYPE_ERROR: ErrorObject = {
  instancePath: '/items/0',
  keyword: 'type',
  message: 'must be string',
  params: TYPE_PARAMS,
  schemaPath: '#/properties/items/items/type'
};
const MESSAGELESS_ERROR: ErrorObject = {
  instancePath: '/amount',
  keyword: 'minimum',
  params: MINIMUM_PARAMS,
  schemaPath: '#/properties/amount/minimum'
};

describe('FEATURE: validation error details', (): void => {
  describe('GIVEN no error list', (): void => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty list', []]
    ])('WHEN the list is %s THEN returns an empty line', (_case: string, errors: ErrorObject[] | null | undefined): void => {
      expect(validationDetails(errors)).toBe('');
    });
  });

  describe('GIVEN one error', (): void => {
    it('WHEN the instance path is set THEN prefixes the message with it', (): void => {
      expect(validationDetails([TYPE_ERROR])).toBe('/items/0: must be string');
    });

    it('WHEN the instance path is empty THEN uses the root slash', (): void => {
      expect(validationDetails([REQUIRED_ERROR])).toBe("/: must have required property 'id'");
    });

    it('WHEN the message is absent THEN falls back to the keyword', (): void => {
      expect(validationDetails([MESSAGELESS_ERROR])).toBe('/amount: minimum');
    });
  });

  describe('GIVEN several errors', (): void => {
    it('WHEN joining THEN separates them with semicolons in order', (): void => {
      const expected = "/: must have required property 'id'; /items/0: must be string";

      expect(validationDetails([REQUIRED_ERROR, TYPE_ERROR])).toBe(expected);
    });
  });
});
