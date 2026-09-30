import { describe, expect, it } from 'vitest';

import { fillObjectShape } from './object-shape-fill.util.ts';
import type { FillOptions } from '../common/fixture-fill.type.ts';

const NO_BODY = 'fixture has no own property "body" for object-shape';

describe('FEATURE: object-shape fill', (): void => {
  describe('GIVEN no object shape', (): void => {
    it('WHEN filling THEN deep-fills the whole value', (): void => {
      const corrupt = { id: 'a' };
      const populated = { status: 'open' };

      const merged = fillObjectShape(corrupt, populated, undefined);

      const value = { id: 'a', status: 'open' };

      expect(merged).toStrictEqual({ value, filled: ['status'] });
    });
  });

  describe('GIVEN an object shape both inputs carry', (): void => {
    it('WHEN filling THEN fills inside it, keeps the other envelope keys and prefixes the filled paths', (): void => {
      const corruptBody = { id: 'a' };
      const corrupt = { statusCode: 200, body: corruptBody };
      const populatedBody = { status: 'open' };
      const populated = { body: populatedBody };

      const merged = fillObjectShape(corrupt, populated, 'body');

      const body = { id: 'a', status: 'open' };
      const value = { statusCode: 200, body };

      expect(merged).toStrictEqual({ value, filled: ['body.status'] });
    });

    it('WHEN the payload arrays gain an element THEN the filled path keeps the index form', (): void => {
      const corrupt = { body: [] };
      const populated = { body: [1] };

      const merged = fillObjectShape(corrupt, populated, 'body');

      expect(merged.filled).toStrictEqual(['body[0]']);
    });

    it('WHEN the whole payload is replaced THEN the filled path is the property name', (): void => {
      const corrupt = { body: 'oops' };
      const populatedBody = { id: 'a' };
      const populated = { body: populatedBody };

      const merged = fillObjectShape(corrupt, populated, 'body');

      expect(merged.filled).toStrictEqual(['body']);
    });
  });

  describe('GIVEN keepPresent and an object shape both inputs carry', (): void => {
    it('WHEN filling THEN a mismatched payload value is kept and only the absent key is filled', (): void => {
      const corruptBody = { amount_due: '4200' };
      const corrupt = { body: corruptBody };
      const populatedBody = { amount_due: 4200, status: 'open' };
      const populated = { body: populatedBody };
      const options: FillOptions = { keepPresent: true };

      const merged = fillObjectShape(corrupt, populated, 'body', options);

      const body = { amount_due: '4200', status: 'open' };
      const value = { body };

      expect(merged).toStrictEqual({ value, filled: ['body.status'] });
    });
  });

  describe('GIVEN an input without the object shape', (): void => {
    it.each<[string, unknown, unknown]>([
      ['the corrupt fixture lacks it', { id: 'a' }, { body: {} }],
      ['the corrupt fixture is not an object', 'oops', { body: {} }],
      ['the populated value lacks it', { body: {} }, { status: 'open' }]
    ])('WHEN %s THEN it throws', (_label: string, corrupt: unknown, populated: unknown): void => {
      expect((): unknown => fillObjectShape(corrupt, populated, 'body')).toThrow(NO_BODY);
    });
  });
});
