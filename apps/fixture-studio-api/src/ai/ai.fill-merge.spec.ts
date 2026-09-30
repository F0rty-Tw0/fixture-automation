import type { MissingFill } from '@fixture-automation/openapi-ai-fixtures';
import { describe, expect, it } from 'vitest';

import type { FillOutcome } from './common/ai.type.ts';
import { aiOutcome, mergedOutcome } from './utils/fill-outcome.util.ts';
import { missingSalvage } from './utils/missing-salvage.util.ts';
import type { MergeResult, MissingFile } from '../contract/common/studio-api.type.ts';
import { fixtureMergeResult } from '../fixture/utils/fixture-merge-result.util.ts';
import { openApiDocument } from '../specs/utils/openapi-document.util.ts';
import { missingFixture } from '../test/utils/studio-spec.spec.util.ts';

type MergedFill = {
  readonly value: unknown;
  readonly filled: string[];
};

const ANY_SCHEMA: Record<string, unknown> = {};
const SCHEMAS = { s: ANY_SCHEMA };
const COMPONENTS = { schemas: SCHEMAS };
const SPEC = openApiDocument({ openapi: '3.0.0', components: COMPONENTS });
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const EMPTY_COMPONENTS = { schemas: EMPTY_SCHEMAS };
const INTEGER = { type: 'integer' };
const TEXT = { type: 'string' };
const X_PROPERTIES = { x: INTEGER };
const CELL = { type: 'object', required: ['x'], properties: X_PROPERTIES };
const ROW = { type: 'array', items: CELL };
const GRID = { type: 'array', items: ROW };
const GRID_PROPERTIES = { grid: GRID };
const GRID_SCHEMA = { type: 'object', required: ['grid'], properties: GRID_PROPERTIES };
const B_PROPERTIES = { b: TEXT };
const B_ITEM = { type: 'object', required: ['b'], properties: B_PROPERTIES };
const ITEMS = { type: 'array', items: B_ITEM };
const ITEMS_PROPERTIES = { items: ITEMS };
const ITEMS_SCHEMA = { type: 'object', required: ['items'], properties: ITEMS_PROPERTIES };
const SKU_PROPERTIES = { sku: TEXT };
const SKU_ITEM = { type: 'object', required: ['sku'], properties: SKU_PROPERTIES };
const LINES = { type: 'array', items: SKU_ITEM };
const LINES_PROPERTIES = { lines: LINES };
const LINES_SCHEMA = { type: 'object', required: ['lines'], properties: LINES_PROPERTIES };
const MIXED_ITEMS = ['keep-me', 7, { a: 1 }];
const MIXED_BASELINE = { items: MIXED_ITEMS };

const missingOf = (paths: string[], schema: unknown): MissingFile => {
  const missing: MissingFile = { schemaName: 's', dialect: 'openapi-30', paths, schema, components: EMPTY_COMPONENTS };

  return missing;
};

/** The fill as the browser sends it back: through JSON, then merged into the baseline by the `merge` route. */
const mergedInto = (fixture: unknown, populated: MissingFill): MergedFill => {
  const sent: unknown = JSON.parse(JSON.stringify(populated));
  const body = { endpointId: 'x', fixture, populated: sent };
  const result: MergeResult = fixtureMergeResult(SPEC, 's', body);
  const value: unknown = JSON.parse(result.mergedJson);
  const merged: MergedFill = { value, filled: result.filled };

  return merged;
};

const salvaged = (missing: MissingFile): FillOutcome => missingSalvage(missing, [], 'codex failed');

describe('FEATURE: a salvaged fill merged into its baseline', (): void => {
  describe('GIVEN a missing value inside an array of arrays', (): void => {
    it('WHEN merged THEN only the missing value is added', (): void => {
      const baseline = { grid: [[{ x: 1 }], [{ x: 2 }], [{}]] };
      const outcome = salvaged(missingOf(['grid[2][0].x'], GRID_SCHEMA));

      const merged = mergedInto(baseline, outcome.populated);

      const grid = [[{ x: 1 }], [{ x: 2 }], [{ x: 0 }]];
      const value = { grid };

      expect(merged).toStrictEqual({ value, filled: ['grid[2][0].x'] });
    });
  });

  describe('GIVEN a missing value after primitive elements of a mixed array', (): void => {
    it('WHEN merged THEN the primitive elements are untouched', (): void => {
      const outcome = salvaged(missingOf(['items[2].b'], ITEMS_SCHEMA));

      const merged = mergedInto(MIXED_BASELINE, outcome.populated);

      const items = ['keep-me', 7, { a: 1, b: 'string' }];
      const value = { items };

      expect(merged).toStrictEqual({ value, filled: ['items[2].b'] });
    });
  });

  describe('GIVEN two chunks filling different elements of one array', (): void => {
    it('WHEN their outcomes merge and land THEN neither chunk nor the baseline loses a value', (): void => {
      const baselineLines = [{ qty: 1 }, { qty: 2 }, { qty: 3 }];
      const baseline = { tags: ['a', 'b'], lines: baselineLines };
      const first = salvaged(missingOf(['lines[0].sku'], LINES_SCHEMA));
      const answerLines = [{}, null, { sku: 'C' }];
      const second = aiOutcome(['lines[2].sku'], { lines: answerLines });
      const outcome = mergedOutcome(first, second);

      const merged = mergedInto(baseline, outcome.populated);

      const lines = [{ qty: 1, sku: 'string' }, { qty: 2 }, { qty: 3, sku: 'C' }];
      const value = { tags: ['a', 'b'], lines };

      expect(merged).toStrictEqual({ value, filled: ['lines[0].sku', 'lines[2].sku'] });
    });
  });

  describe('GIVEN a model answer padded with empty objects and nulls', (): void => {
    it('WHEN merged THEN the padding changes nothing in the baseline', (): void => {
      const answerItems = [{}, null, { b: 'x' }];
      const outcome = aiOutcome(['items[2].b'], { items: answerItems });

      const merged = mergedInto(MIXED_BASELINE, outcome.populated);

      const items = ['keep-me', 7, { a: 1, b: 'x' }];
      const value = { items };

      expect(merged).toStrictEqual({ value, filled: ['items[2].b'] });
    });
  });

  describe('GIVEN a list fixture whose missing paths start at an index', (): void => {
    it('WHEN merged THEN each missing value lands in its element and the others are untouched', async (): Promise<void> => {
      const baseline = [{ id: 'a' }, { id: 'b', status: 'open' }, { id: 'c' }];
      const outcome = salvaged(await missingFixture('list'));

      const merged = mergedInto(baseline, outcome.populated);

      const value = [
        { id: 'a', status: 'draft' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'draft' }
      ];

      expect(merged).toStrictEqual({ value, filled: ['[0].status', '[2].status'] });
    });
  });
});
