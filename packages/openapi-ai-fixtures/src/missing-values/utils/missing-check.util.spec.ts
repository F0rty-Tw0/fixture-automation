import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import { missingCheck } from './missing-check.util.ts';
import { parseMissingFile } from './missing-file.util.ts';
import { integrationFile } from '../../test/utils/integration-project.spec.util.ts';
import type { MissingFile, MissingVerdict } from '../common/missing.type.ts';

const FILLED = { status: 'open' };
const UNLISTED = { status: 'paid' };

describe('FEATURE: missing fill check', (): void => {
  describe('GIVEN the invoice missing projection', (): void => {
    let missing: MissingFile;

    beforeAll(async (): Promise<void> => {
      const text = await readFile(integrationFile('missing.json'), 'utf8');

      missing = parseMissingFile(text);
    });

    it('WHEN the fill satisfies it THEN is valid without details', (): void => {
      const expected: MissingVerdict = { valid: true, details: '' };
      const check = missingCheck(missing);

      const verdict = check(FILLED);

      expect(verdict).toStrictEqual(expected);
    });

    it('WHEN the fill breaks it THEN is invalid with the failing path', (): void => {
      const check = missingCheck(missing);

      const verdict = check(UNLISTED);

      expect(verdict.valid).toBe(false);
      expect(verdict.details).toMatch(/^\/status: /);
    });
  });

  describe('GIVEN a projection whose pattern is not a valid regex', (): void => {
    it('WHEN compiled THEN throws before any fill is judged', (): void => {
      const name = { type: 'string', pattern: '(' };
      const properties = { name };
      const schema = { type: 'object', properties };
      const components = { schemas: {} };
      const broken: MissingFile = { schemaName: 'named', dialect: 'openapi-30', paths: ['name'], schema, components };

      const compiling = (): unknown => missingCheck(broken);

      expect(compiling).toThrow();
    });
  });
});
