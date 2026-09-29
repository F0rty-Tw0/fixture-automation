import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import type { BrokenEntry, FixtureDiffRequest } from './common/missing.type.ts';
import { diffFixture } from './domain-logic/fixture-diff.ts';
import { generatedAccount, placeholderSpec, realAccount } from './test/utils/placeholder-spec.spec.util.ts';
import { dropPaths } from '../shared/fixture-path/utils/drop-path.util.ts';

const SAMPLER_DEFAULTS = [
  'id',
  'email',
  'created',
  'has_more',
  'balance',
  'rate',
  'website',
  'code',
  'owner_id',
  'note',
  'tags',
  'country',
  'lines[0].sku',
  'lines[0].quantity'
];
const KEPT_LINE = { price_id: 'price_1' };
const AUTHOR_VALUES = {
  object: 'account',
  active: false,
  nickname: 'Ace',
  status: 'open',
  kind: 'acct',
  labels: ['vip'],
  source: 'internal',
  metadata: {},
  lines: [KEPT_LINE]
};
const INVALID_PATHS = ['object', 'has_more', 'nickname', 'labels', 'metadata', 'lines[0].price_id'];
const HAS_MORE_BROKEN: BrokenEntry = { path: 'has_more', value: null, reason: 'must be boolean' };
const NICKNAME_BROKEN: BrokenEntry = { path: 'nickname', value: 5, reason: 'must be string' };
const PLACEHOLDER_REASON = 'openapi-sampler placeholder';

const brokenPaths = (broken: BrokenEntry[]): string[] => broken.map((entry: BrokenEntry): string => entry.path);

describe('FEATURE: placeholder and invalid value replacement', (): void => {
  let spec: OpenApiSpec;

  const request = (fixture: unknown, replacePlaceholders: boolean, objectShape?: string): FixtureDiffRequest => {
    const built: FixtureDiffRequest = { spec, schemaName: 'account', fixture, requiredOnly: false, objectShape, replacePlaceholders };

    return built;
  };

  beforeAll(async (): Promise<void> => {
    spec = await placeholderSpec();
  });

  describe('GIVEN a fixture our own generator wrote', (): void => {
    describe('WHEN diffed with replacePlaceholders', (): void => {
      it('THEN every sampler type default is replaced and listed as missing', (): void => {
        const diff = diffFixture(request(generatedAccount(spec), true));

        expect(diff.replaced).toStrictEqual(SAMPLER_DEFAULTS);
        expect(diff.paths).toStrictEqual(SAMPLER_DEFAULTS);
      });

      it('THEN the baseline keeps only the enum, const, default and example values', (): void => {
        const diff = diffFixture(request(generatedAccount(spec), true));

        expect(diff.baseline).toStrictEqual(AUTHOR_VALUES);
      });

      it('THEN the original fixture is not mutated', (): void => {
        const fixture = generatedAccount(spec);

        diffFixture(request(fixture, true));

        expect(fixture).toStrictEqual(generatedAccount(spec));
      });
    });

    it('WHEN diffed with replacePlaceholders THEN every replaced value is reported broken as a sampler placeholder', (): void => {
      const diff = diffFixture(request(generatedAccount(spec), true));

      expect(brokenPaths(diff.broken)).toStrictEqual(SAMPLER_DEFAULTS);
      expect(diff.broken).toContainEqual({ path: 'balance', value: 0, reason: PLACEHOLDER_REASON });
    });

    it('WHEN diffed without replacePlaceholders THEN the placeholders are still reported broken', (): void => {
      const diff = diffFixture(request(generatedAccount(spec), false));

      expect(brokenPaths(diff.broken)).toStrictEqual(SAMPLER_DEFAULTS);
    });

    it('WHEN diffed inside a body envelope without replacePlaceholders THEN broken paths carry the envelope', (): void => {
      const fixture = { statusCode: 200, body: generatedAccount(spec) };
      const wrapped = SAMPLER_DEFAULTS.map((path: string): string => `body.${path}`);

      const diff = diffFixture(request(fixture, false, 'body'));

      expect(brokenPaths(diff.broken)).toStrictEqual(wrapped);
    });

    it('WHEN diffed without replacePlaceholders THEN nothing is replaced and the baseline is the fixture', (): void => {
      const fixture = generatedAccount(spec);

      const diff = diffFixture(request(fixture, false));

      expect(diff.replaced).toStrictEqual([]);
      expect(diff.paths).toStrictEqual([]);
      expect(diff.baseline).toStrictEqual(fixture);
    });

    it('WHEN diffed inside a body envelope THEN replaced paths carry the envelope and siblings stay', (): void => {
      const fixture = { statusCode: 200, body: generatedAccount(spec) };
      const wrapped = SAMPLER_DEFAULTS.map((path: string): string => `body.${path}`);

      const diff = diffFixture(request(fixture, true, 'body'));

      expect(diff.replaced).toStrictEqual(wrapped);
      const body = { object: 'account' };

      expect(diff.baseline).toMatchObject({ statusCode: 200, body });
      expect(diff.baseline).not.toHaveProperty('body.id');
    });
  });

  describe('GIVEN a fixture of real, schema-valid values', (): void => {
    it('WHEN diffed with replacePlaceholders THEN nothing is replaced', async (): Promise<void> => {
      const fixture = await realAccount();

      const diff = diffFixture(request(fixture, true));

      expect(diff.paths).toStrictEqual([]);
      expect(diff.baseline).toStrictEqual(fixture);
    });

    it('WHEN diffed THEN nothing is reported broken', async (): Promise<void> => {
      const fixture = await realAccount();

      const diff = diffFixture(request(fixture, false));

      expect(diff.broken).toStrictEqual([]);
    });

    it('WHEN a required key is dropped THEN it is only missing, never a replaced parent', async (): Promise<void> => {
      const fixture = dropPaths(await realAccount(), ['lines[0].sku']);

      const diff = diffFixture(request(fixture, true));

      expect(diff.paths).toStrictEqual(['lines[0].sku']);
      expect(diff.replaced).toStrictEqual([]);
    });
  });

  describe('GIVEN real values broken against the schema', (): void => {
    it('WHEN diffed with replacePlaceholders THEN each invalid value is replaced at its property path', async (): Promise<void> => {
      const account = await realAccount();
      const line = { sku: 'sku_1', quantity: 3, price_id: 9 };
      const invalid = {
        ...account,
        has_more: null,
        object: 'string',
        metadata: 'string',
        nickname: 5,
        labels: ['new', 5],
        lines: [line]
      };

      const diff = diffFixture(request(invalid, true));

      expect(diff.replaced).toStrictEqual(INVALID_PATHS);
      expect(diff.baseline).not.toHaveProperty('metadata');
      expect(diff.baseline).toHaveProperty('lines.0.sku', 'sku_1');
    });

    it('WHEN diffed with replacePlaceholders THEN each invalid value is reported broken with its AJV message', async (): Promise<void> => {
      const account = await realAccount();
      const invalid = { ...account, has_more: null, nickname: 5 };

      const diff = diffFixture(request(invalid, true));

      expect(diff.broken).toStrictEqual([HAS_MORE_BROKEN, NICKNAME_BROKEN]);
    });

    it('WHEN diffed without replacePlaceholders THEN the invalid values are still reported broken', async (): Promise<void> => {
      const account = await realAccount();
      const invalid = { ...account, has_more: null, nickname: 5 };

      const diff = diffFixture(request(invalid, false));

      expect(diff.broken).toStrictEqual([HAS_MORE_BROKEN, NICKNAME_BROKEN]);
    });

    it('WHEN diffed without replacePlaceholders THEN the invalid values stay put', async (): Promise<void> => {
      const account = await realAccount();
      const invalid = { ...account, has_more: null };

      const diff = diffFixture(request(invalid, false));

      expect(diff.replaced).toStrictEqual([]);
      expect(diff.baseline).toHaveProperty('has_more', null);
    });
  });
});
