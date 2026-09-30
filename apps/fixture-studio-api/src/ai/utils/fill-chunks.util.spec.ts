import { pathPattern } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { fillChunks } from './fill-chunks.util.ts';
import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { missingFixture } from '../../test/utils/studio-spec.spec.util.ts';
import type { FillChunk } from '../common/ai.type.ts';

const SCENARIO = 'An overdue invoice.';
const INVOICE = { id: 'in_9', amount_due: 5 };
const LARGE_INVOICE = { ...INVOICE, memo: 'm'.repeat(300 * 1024) };
const HUGE_INVOICE = { ...INVOICE, memo: 'm'.repeat(1100 * 1024) };
const LONG_SCENARIO = 's'.repeat(300 * 1024);
const TEXT_SCHEMA = { type: 'string' };
const DESCRIBED_SCHEMA = { ...TEXT_SCHEMA, description: 'd'.repeat(100 * 1024) };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const EMPTY_COMPONENTS = { schemas: EMPTY_SCHEMAS };

const LINE_COUNT = 1000;
const LINE_FIELDS = 6;

const fieldName = (_item: unknown, index: number): string => `f${index}`;

/** Every `lines[i].f<n>` path, item by item, for `count` lines of `fields` string fields each. */
const linePaths = (count: number, fields: number): string[] => {
  const names = Array.from({ length: fields }, fieldName);
  const itemPaths = (_item: unknown, index: number): string[] => names.map((name: string): string => `lines[${index}].${name}`);

  return Array.from({ length: count }, itemPaths).flat();
};

/** A projection of `count` lines each missing `fields` fields of `fieldSchema`: `fields` patterns of `count` paths. */
const linesMissing = (count: number, fields: number, fieldSchema: unknown = TEXT_SCHEMA): MissingFile => {
  const names = Array.from({ length: fields }, fieldName);
  const entries = names.map((name: string): [string, unknown] => [name, fieldSchema]);
  const properties = Object.fromEntries(entries);
  const items = { type: 'object', properties };
  const lines = { type: 'array', items };
  const lineProperties = { lines };
  const schema = { type: 'object', properties: lineProperties };
  const paths = linePaths(count, fields);
  const missing: MissingFile = { schemaName: 'order', dialect: 'openapi-30', paths, schema, components: EMPTY_COMPONENTS };

  return missing;
};

const lineItem = (_item: unknown, index: number): Record<string, unknown> => {
  const item = { id: `line_${index}` };

  return item;
};

const chunkPatterns = (chunk: FillChunk): string[] => {
  const patterns = chunk.paths.map(pathPattern);
  const unique = new Set(patterns);

  return [...unique];
};

/** A flat projection of `count` string fields, `f0` to `f<count - 1>`. */
const wideMissing = (count: number): MissingFile => {
  const names = Array.from({ length: count }, fieldName);
  const entries = names.map((name: string): [string, unknown] => [name, TEXT_SCHEMA]);
  const properties = Object.fromEntries(entries);
  const schema = { type: 'object', properties };
  const missing: MissingFile = { schemaName: 'wide', dialect: 'openapi-30', paths: names, schema, components: EMPTY_COMPONENTS };

  return missing;
};

const chunkSize = (chunk: FillChunk): number => chunk.paths.length;

const chunkPaths = (chunk: FillChunk): string[] => chunk.paths;

const isOversized = (chunk: FillChunk): boolean => chunk.isOversized;

describe('FEATURE: CLI fill chunk planning', (): void => {
  let missing: MissingFile;

  beforeAll(async (): Promise<void> => {
    missing = await missingFixture('customer');
  });

  describe('GIVEN a fill whose prompt fits the chunk budget', (): void => {
    it('WHEN planned THEN one chunk holds every missing path', (): void => {
      const chunks = fillChunks(INVOICE, missing, SCENARIO);

      expect(chunks).toStrictEqual([{ paths: ['status', 'customer'], isOversized: false }]);
    });
  });

  describe('GIVEN a fixture whose prompt exceeds the chunk budget', (): void => {
    it('WHEN planned THEN the patterns are halved until each chunk fits or holds one pattern', (): void => {
      const chunks = fillChunks(LARGE_INVOICE, missing, SCENARIO);

      expect(chunks.map(chunkPaths)).toStrictEqual([['status'], ['customer']]);
      expect(chunks.map(isOversized)).toStrictEqual([false, false]);
    });
  });

  describe('GIVEN a small fixture and a scenario longer than the chunk budget', (): void => {
    it('WHEN planned THEN the scenario counts in every chunk, so each path runs alone', (): void => {
      const fourFields = wideMissing(4);

      const chunks = fillChunks(INVOICE, fourFields, LONG_SCENARIO);

      expect(chunks.map(chunkPaths)).toStrictEqual([['f0'], ['f1'], ['f2'], ['f3']]);
    });
  });

  describe('GIVEN more missing patterns than one chunk may ask for', (): void => {
    it('WHEN planned THEN the patterns are sliced 150 at a time, in missing order, without halving', (): void => {
      const wide = wideMissing(200);

      const chunks = fillChunks({}, wide, SCENARIO);

      expect(chunks.map(chunkSize)).toStrictEqual([150, 50]);
      expect(chunks.flatMap(chunkPaths)).toStrictEqual(wide.paths);
    });
  });

  describe('GIVEN 6000 missing paths that repeat 6 fields over 1000 array items', (): void => {
    it('WHEN planned THEN one chunk holds every path, since the prompt asks per pattern', (): void => {
      const lines = linesMissing(LINE_COUNT, LINE_FIELDS);
      const items = Array.from({ length: LINE_COUNT }, lineItem);
      const order = { id: 'or_1', currency: 'eur', lines: items };

      const chunks = fillChunks(order, lines, SCENARIO);

      expect(chunks).toStrictEqual([{ paths: lines.paths, isOversized: false }]);
    });
  });

  describe('GIVEN array patterns whose prompts each exceed the chunk budget', (): void => {
    it('WHEN planned THEN each chunk holds whole patterns, never part of one', (): void => {
      const lines = linesMissing(10, 4);
      const items = Array.from({ length: 10 }, lineItem);
      const order = { ...LARGE_INVOICE, lines: items };

      const chunks = fillChunks(order, lines, SCENARIO);

      expect(chunks.map(chunkPatterns)).toStrictEqual([['lines[*].f0'], ['lines[*].f1'], ['lines[*].f2'], ['lines[*].f3']]);
      expect(chunks.map(chunkSize)).toStrictEqual([10, 10, 10, 10]);
    });
  });

  describe('GIVEN array patterns over the chunk budget together whose halves each fit it', (): void => {
    it('WHEN planned THEN the slice is halved once, not down to single patterns', (): void => {
      const lines = linesMissing(3, 4, DESCRIBED_SCHEMA);

      const chunks = fillChunks(INVOICE, lines, SCENARIO);

      expect(chunks.map(chunkPatterns)).toStrictEqual([
        ['lines[*].f0', 'lines[*].f1'],
        ['lines[*].f2', 'lines[*].f3']
      ]);
    });
  });

  describe('GIVEN one path whose own prompt exceeds the 1 MiB CLI limit', (): void => {
    it('WHEN planned THEN each such path is a chunk of its own marked oversized', (): void => {
      const chunks = fillChunks(HUGE_INVOICE, missing, SCENARIO);

      expect(chunks).toStrictEqual([
        { paths: ['status'], isOversized: true },
        { paths: ['customer'], isOversized: true }
      ]);
    });
  });

  describe('GIVEN no missing paths and a fixture whose prompt exceeds the chunk budget', (): void => {
    it('WHEN planned THEN throws a FixtureError instead of halving an empty list forever', (): void => {
      const empty = wideMissing(0);

      const plan = (): FillChunk[] => fillChunks(LARGE_INVOICE, empty, SCENARIO);

      expect(plan).toThrow(FixtureError);
      expect(plan).toThrow('there are no missing paths to fill');
    });
  });

  describe('GIVEN a fixture that is not JSON-serializable', (): void => {
    it('WHEN planned THEN throws a FixtureError', (): void => {
      const plan = (): FillChunk[] => fillChunks(undefined, missing, SCENARIO);

      expect(plan).toThrow('the fixture is not JSON-serializable');
    });
  });
});
