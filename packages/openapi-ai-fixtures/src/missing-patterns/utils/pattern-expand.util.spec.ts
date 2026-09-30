import { describe, expect, it } from 'vitest';

import { expandedFill } from './pattern-expand.util.ts';
import { valueAtPath } from '../../missing-values/utils/path-tree.util.ts';
import type { MissingPattern } from '../common/missing-pattern.type.ts';

const pattern = (name: string, paths: string[]): MissingPattern => {
  const missingPattern: MissingPattern = { pattern: name, paths };

  return missingPattern;
};

const QUANTITIES = pattern('lines[*].qty', ['lines[0].qty', 'lines[1].qty', 'lines[2].qty']);
const SKUS = pattern('lines[*].sku', ['lines[0].sku', 'lines[1].sku']);
const STATUS = pattern('status', ['status']);
const OWNERS = pattern('lines[*].owner', ['lines[0].owner', 'lines[1].owner']);
const LIST_IDS = pattern('[*].id', ['[0].id', '[2].id']);
const OWNER_IDS = { primary: 'id-{n}-{n}' };
const OWNER = { name: 'Owner {n}', tags: ['t-{n}', 7], ids: OWNER_IDS };

describe('FEATURE: pattern answer expansion', (): void => {
  describe('GIVEN an answer keyed by pattern', (): void => {
    it('WHEN a pattern has fewer examples than paths THEN the examples repeat cyclically', (): void => {
      const answer = { 'lines[*].qty': [3, 1] };

      const lines = [{ qty: 3 }, { qty: 1 }, { qty: 3 }];

      const fill = expandedFill(answer, [QUANTITIES], false);

      expect(fill).toStrictEqual({ lines });
    });

    it('WHEN a string example holds {n} THEN each path gets its 1-based ordinal', (): void => {
      const answer = { 'lines[*].sku': ['SKU-{n}'] };

      const lines = [{ sku: 'SKU-1' }, { sku: 'SKU-2' }];

      const fill = expandedFill(answer, [SKUS], false);

      expect(fill).toStrictEqual({ lines });
    });

    it('WHEN an object example nests {n} strings THEN every one is replaced and other values stay', (): void => {
      const answer = { 'lines[*].owner': [OWNER] };
      const firstIds = { primary: 'id-1-1' };
      const secondIds = { primary: 'id-2-2' };
      const first = { name: 'Owner 1', tags: ['t-1', 7], ids: firstIds };
      const second = { name: 'Owner 2', tags: ['t-2', 7], ids: secondIds };
      const lines = [{ owner: first }, { owner: second }];

      const fill = expandedFill(answer, [OWNERS], false);

      expect(fill).toStrictEqual({ lines });
    });

    it('WHEN one example object fills several paths THEN no two paths share a reference', (): void => {
      const owner = { tags: ['a'] };
      const answer = { 'lines[*].owner': [owner] };

      const fill = expandedFill(answer, [OWNERS], false);

      const first = valueAtPath(fill, 'lines[0].owner');
      const second = valueAtPath(fill, 'lines[1].owner');

      expect(first).not.toBe(second);
      expect(first).not.toBe(owner);
      expect(valueAtPath(first, 'tags')).not.toBe(valueAtPath(second, 'tags'));
    });

    it('WHEN a pattern key is absent or holds no examples THEN its paths stay absent', (): void => {
      const answer = { 'lines[*].qty': [], status: ['open'] };

      const fill = expandedFill(answer, [QUANTITIES, STATUS, SKUS], false);

      expect(fill).toStrictEqual({ status: 'open' });
    });

    it('WHEN a pattern holds a non-array value while another holds examples THEN only the non-array one stays absent', (): void => {
      const answer = { 'lines[*].sku': ['s'], status: 'open' };

      const lines = [{ sku: 's' }, { sku: 's' }];

      const fill = expandedFill(answer, [SKUS, STATUS], false);

      expect(fill).toStrictEqual({ lines });
    });

    it('WHEN no pattern holds an example THEN the answer is returned unchanged', (): void => {
      const answer = { '[*].id': [] };

      const fill = expandedFill(answer, [LIST_IDS], true);

      expect(fill).toBe(answer);
    });

    it('WHEN the fill is a list THEN the expansion is a list with holes at unlisted indices', (): void => {
      const answer = { '[*].id': ['id-{n}'] };

      const fill = expandedFill(answer, [LIST_IDS], true);

      expect(JSON.stringify(fill)).toBe('[{"id":"id-1"},null,{"id":"id-2"}]');
    });
  });

  describe('GIVEN an answer that ignores the pattern format', (): void => {
    it('WHEN it is a concrete-shaped object THEN it is returned unchanged', (): void => {
      const lines = [{ qty: 1 }];
      const answer = { lines, status: 'open' };

      const fill = expandedFill(answer, [QUANTITIES, STATUS], false);

      expect(fill).toBe(answer);
    });

    it('WHEN it is a concrete-shaped list THEN it is returned unchanged', (): void => {
      const answer = [{ id: 'a' }];

      const fill = expandedFill(answer, [LIST_IDS], true);

      expect(fill).toBe(answer);
    });

    it('WHEN it is not an object or a list THEN it is returned unchanged', (): void => {
      const fill = expandedFill(42, [LIST_IDS], true);

      expect(fill).toBe(42);
    });
  });

  describe('GIVEN an answer to expand', (): void => {
    it('WHEN expanded THEN the answer is not mutated', (): void => {
      const answer = { 'lines[*].owner': [OWNER] };
      const before = structuredClone(answer);

      expandedFill(answer, [OWNERS], false);

      expect(answer).toStrictEqual(before);
    });
  });
});
