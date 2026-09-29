import { strict as assert } from 'node:assert';

import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { isPlaceholderValue } from './placeholder-value.util.ts';
import type { SpecSchemas } from '../../schema/common/schema.type.ts';
import { isSchema } from '../../schema/utils/schema-record.util.ts';
import type { ReplaceCandidate } from '../common/missing.type.ts';
import { generatedAccount, placeholderSpec } from '../test/utils/placeholder-spec.spec.util.ts';

const OBJECT_ITEMS = [{ sku: 'string' }];

describe('FEATURE: openapi-sampler placeholder detection', (): void => {
  let schemas: SpecSchemas;
  let account: Record<string, unknown>;

  const candidate = (key: string, value: unknown): ReplaceCandidate => {
    const owner = schemas['account'];
    const schema = owner?.properties?.[key];

    assert(isSchema(schema), `expected an account property "${key}"`);

    const built: ReplaceCandidate = { path: key, key, schema, value };

    return built;
  };

  beforeAll(async (): Promise<void> => {
    const spec: OpenApiSpec = await placeholderSpec();

    schemas = spec.components?.schemas ?? {};
    account = generatedAccount(spec);
  });

  describe('GIVEN the values our generator wrote for schemas without author values', (): void => {
    it.each(['id', 'email', 'created', 'has_more', 'balance', 'rate', 'website', 'code', 'owner_id', 'note', 'country'])(
      'WHEN checking %s THEN it is a placeholder',
      (key: string): void => {
        const isPlaceholder = isPlaceholderValue(candidate(key, account[key]), schemas);

        expect(isPlaceholder).toBe(true);
      }
    );
  });

  describe('GIVEN values the schema author provided', (): void => {
    it.each(['object', 'active', 'nickname', 'status', 'kind', 'source'])('WHEN checking %s THEN it is kept', (key: string): void => {
      const isPlaceholder = isPlaceholderValue(candidate(key, account[key]), schemas);

      expect(isPlaceholder).toBe(false);
    });
  });

  describe('GIVEN real values of the same types', (): void => {
    it.each([
      ['id', 'acct_1'],
      ['has_more', false],
      ['balance', 4200],
      ['note', null]
    ])('WHEN checking %s = %s THEN it is kept', (key: string, value: unknown): void => {
      const isPlaceholder = isPlaceholderValue(candidate(key, value), schemas);

      expect(isPlaceholder).toBe(false);
    });
  });

  describe('GIVEN a uuid seeded by another property name', (): void => {
    it('WHEN checking it under owner_id THEN it is kept', (): void => {
      const foreign = candidate('owner_id', account['owner_id']);
      const renamed: ReplaceCandidate = { ...foreign, key: 'creator_id' };

      const isPlaceholder = isPlaceholderValue(renamed, schemas);

      expect(isPlaceholder).toBe(false);
    });
  });

  describe('GIVEN arrays', (): void => {
    it.each([
      ['tags', ['string'], true],
      ['tags', ['vip', 'string'], true],
      ['tags', ['vip'], false],
      ['tags', [], false],
      ['labels', ['vip'], false],
      ['lines', OBJECT_ITEMS, false]
    ])('WHEN checking %s = %j THEN placeholder is %s', (key: string, value: unknown, expected: boolean): void => {
      const isPlaceholder = isPlaceholderValue(candidate(key, value), schemas);

      expect(isPlaceholder).toBe(expected);
    });
  });

  describe('GIVEN an object value', (): void => {
    it('WHEN checking it THEN it is never a placeholder itself', (): void => {
      const isPlaceholder = isPlaceholderValue(candidate('metadata', {}), schemas);

      expect(isPlaceholder).toBe(false);
    });
  });
});
