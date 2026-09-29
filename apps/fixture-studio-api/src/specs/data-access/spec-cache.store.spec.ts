import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { SpecCache } from './spec-cache.store.ts';

const TITLES = ['1', '2', '3', '4', '5'];

const specNamed = (title: string): OpenApiSpec => {
  const info = { title };
  const spec: OpenApiSpec = { openapi: '3.0.0', info };

  return spec;
};

/** Whether `specId` is still cached; a hit also marks it most recently used, so check evictions first. */
const isCached = (cache: SpecCache, specId: string): boolean => {
  try {
    cache.require(specId);

    return true;
  } catch {
    return false;
  }
};

const filledCache = (): [SpecCache, string[]] => {
  const cache = new SpecCache();
  const ids = TITLES.map((title: string): string => cache.add(specNamed(title)));
  const filled: [SpecCache, string[]] = [cache, ids];

  return filled;
};

describe('FEATURE: spec cache', (): void => {
  describe('GIVEN an empty cache', (): void => {
    it('WHEN a spec is added THEN it is required back by the returned id', (): void => {
      const cache = new SpecCache();
      const spec = specNamed('a');

      const specId = cache.add(spec);

      expect(cache.require(specId)).toBe(spec);
    });

    it('WHEN two specs are added THEN each gets its own id', (): void => {
      const cache = new SpecCache();

      const first = cache.add(specNamed('a'));
      const second = cache.add(specNamed('b'));

      expect(first).not.toBe(second);
    });

    it('WHEN an unknown id is required THEN fails with a 404 and a reload fix', (): void => {
      const cache = new SpecCache();

      expect((): unknown => cache.require('missing')).toThrow(
        expect.objectContaining({
          statusCode: 404,
          message: 'spec not found',
          fix: 'load the spec again; the API keeps only the last few in memory'
        })
      );
    });
  });

  describe('GIVEN a cache holding five specs', (): void => {
    it('WHEN a sixth is added THEN only the least recently used one is evicted', (): void => {
      const [cache, ids] = filledCache();
      const [firstId, ...keptIds] = ids;

      const sixthId = cache.add(specNamed('6'));

      const newestIds = [...keptIds, sixthId];

      expect(isCached(cache, firstId ?? '')).toBe(false);
      expect(newestIds.every((specId: string): boolean => isCached(cache, specId))).toBe(true);
    });

    it('WHEN the oldest was required before a sixth is added THEN it survives and the next oldest goes', (): void => {
      const [cache, ids] = filledCache();
      const [firstId = '', secondId = ''] = ids;

      cache.require(firstId);
      cache.add(specNamed('6'));

      expect(isCached(cache, secondId)).toBe(false);
      expect(isCached(cache, firstId)).toBe(true);
    });
  });
});
