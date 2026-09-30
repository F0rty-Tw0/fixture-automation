import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { aiOutcome, mergedOutcome, unfilledOutcome } from './fill-outcome.util.ts';
import type { FillSource } from '../../contract/common/studio-api.type.ts';
import type { FillOutcome } from '../common/ai.type.ts';

const LINE = { sku: 'A' };
const STATUS = { status: 'open' };
const LINES = { lines: [LINE] };
const STATUS_SOURCES: Record<string, FillSource> = { status: 'ai' };
const LINE_SOURCES: Record<string, FillSource> = { 'lines[0].sku': 'sampler' };
const STATUS_FILL: FillOutcome = { populated: STATUS, sources: STATUS_SOURCES, notes: [] };
const LINE_FILL: FillOutcome = { populated: LINES, sources: LINE_SOURCES, notes: ['Chunk 2 of 2: salvaged.'] };

describe('FEATURE: fill outcomes', (): void => {
  describe('GIVEN a projection-valid model answer', (): void => {
    it('WHEN turned into an outcome THEN every path comes from the model and there are no notes', (): void => {
      const populated = { status: 'open', customer: LINE };

      const outcome = aiOutcome(['status', 'customer.sku'], populated);

      const sources = { status: 'ai', 'customer.sku': 'ai' };

      expect(outcome).toStrictEqual({ populated, sources, notes: [] });
    });
  });

  describe('GIVEN a valid answer padded around its missing paths', (): void => {
    it('WHEN turned into an outcome THEN keeps only the missing paths and leaves the padding as holes', (): void => {
      const items = [{}, null, { b: 'x' }];
      const padded = { items, extra: 1 };

      const outcome = aiOutcome(['items[2].b'], padded);

      expect(JSON.stringify(outcome.populated)).toBe('{"items":[null,null,{"b":"x"}]}');
    });

    it('WHEN the answer is a list THEN the outcome is a list', (): void => {
      const answer = [{}, { status: 'open' }];

      const outcome = aiOutcome(['[1].status'], answer);

      expect(JSON.stringify(outcome.populated)).toBe('[null,{"status":"open"}]');
    });
  });

  describe('GIVEN a chunk that could not be filled at all', (): void => {
    it('WHEN its paths start at an index THEN the empty fill is a list', (): void => {
      const outcome = unfilledOutcome(['[0].status'], 'codex failed', new Error('worker exited'));

      expect(outcome.populated).toStrictEqual([]);
    });

    it('WHEN the reason is a FixtureError THEN every path is unfilled and the note carries its message and fix', (): void => {
      const error = new FixtureError('spec too expensive', 'raise the budget');

      const outcome = unfilledOutcome(['status'], 'codex failed', error);

      const sources = { status: 'unfilled' };
      const notes = ['codex failed; 1 value could not be filled: spec too expensive (raise the budget).'];

      expect(outcome).toStrictEqual({ populated: {}, sources, notes });
    });

    it('WHEN the reason is a plain Error THEN the note carries only its first message line', (): void => {
      const outcome = unfilledOutcome(['a', 'b'], 'codex failed', new Error('worker exited\n    at stack'));

      expect(outcome.notes).toStrictEqual(['codex failed; 2 values could not be filled: worker exited.']);
    });

    it('WHEN the reason is not an Error THEN the note says the salvage failed', (): void => {
      const outcome = unfilledOutcome(['a'], 'codex failed', 'boom');

      expect(outcome.notes).toStrictEqual(['codex failed; 1 value could not be filled: salvage failed.']);
    });
  });

  describe('GIVEN two chunk outcomes', (): void => {
    it('WHEN merged THEN values, sources and notes combine in chunk order', (): void => {
      const outcome = mergedOutcome(STATUS_FILL, LINE_FILL);

      const populated = { ...STATUS, ...LINES };
      const sources = { ...STATUS_SOURCES, ...LINE_SOURCES };

      expect(outcome).toStrictEqual({ populated, sources, notes: LINE_FILL.notes });
    });
  });
});
