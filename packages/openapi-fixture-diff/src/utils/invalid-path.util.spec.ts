import { describe, expect, it } from 'vitest';

import { invalidPaths } from './invalid-path.util.ts';
import type { SchemaViolation } from '../common/missing.type.ts';

const LINE = { sku: 7, tags: ['a', 5] };
const CODES = { '200': 'ok' };
const ESCAPED = { 'c~d': 1 };
const ORDER = { id: 'or_1', lines: [LINE], codes: CODES, 'a/b': ESCAPED };
const ROWS = [{ id: 1 }];

const violation = (keyword: string, instancePath: string): SchemaViolation => {
  const found: SchemaViolation = { keyword, instancePath };

  return found;
};

describe('FEATURE: invalid value paths from AJV errors', (): void => {
  describe('GIVEN an AJV error pointing into an object fixture', (): void => {
    it.each([
      ['/id', 'id'],
      ['/lines/0/sku', 'lines[0].sku'],
      ['/codes/200', 'codes.200'],
      ['/a~1b/c~0d', 'a/b.c~d']
    ])('WHEN its pointer is %s THEN the diff path is %s', (pointer: string, expected: string): void => {
      const paths = invalidPaths([violation('type', pointer)], ORDER);

      expect([...paths]).toStrictEqual([expected]);
    });
  });

  describe('GIVEN an AJV error pointing into an array fixture', (): void => {
    it('WHEN collected THEN the root index starts the path', (): void => {
      const paths = invalidPaths([violation('type', '/0/id')], ROWS);

      expect([...paths]).toStrictEqual(['[0].id']);
    });
  });

  describe('GIVEN AJV errors of leaf and wrapper keywords', (): void => {
    it('WHEN collecting the invalid paths THEN only leaf keywords flag a path', (): void => {
      const errors = [
        violation('type', '/id'),
        violation('enum', '/lines/0/sku'),
        violation('required', '/lines/0'),
        violation('anyOf', '/codes'),
        violation('oneOf', '/codes'),
        violation('additionalProperties', ''),
        violation('if', '/codes'),
        violation('then', '/codes'),
        violation('else', '/codes'),
        violation('not', '/codes')
      ];

      const paths = invalidPaths(errors, ORDER);

      expect([...paths]).toStrictEqual(['id', 'lines[0].sku']);
    });
  });

  describe('GIVEN an AJV error on a primitive array element', (): void => {
    it('WHEN collecting the invalid paths THEN the enclosing property is flagged once', (): void => {
      const errors = [violation('type', '/lines/0/tags/1'), violation('minLength', '/lines/0/tags/1')];

      const paths = invalidPaths(errors, ORDER);

      expect([...paths]).toStrictEqual(['lines[0].tags']);
    });
  });

  describe('GIVEN an AJV error on the payload root', (): void => {
    it('WHEN collecting the invalid paths THEN nothing is flagged', (): void => {
      const errors = [violation('type', ''), violation('type', '/0')];

      const paths = invalidPaths(errors, ROWS);

      expect([...paths]).toStrictEqual([]);
    });
  });
});
