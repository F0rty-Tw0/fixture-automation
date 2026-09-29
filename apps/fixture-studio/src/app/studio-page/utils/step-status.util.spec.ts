import type { DiffResult, MergeResult } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { fillStatus, missingStatus } from './step-status.util.ts';
import { DIFF_RESULT_STUB, MERGE_RESULT_STUB } from '../../test/stubs/studio.stub.ts';

const BROKEN_MEMO = { path: 'memo', value: 'string', reason: 'openapi-sampler placeholder' };
const WITH_BROKEN: DiffResult = { ...DIFF_RESULT_STUB, missingPaths: ['status', 'memo'], replacedPaths: ['memo'], broken: [BROKEN_MEMO] };
const NOTHING_MISSING: DiffResult = { ...DIFF_RESULT_STUB, missingPaths: [] };
const INVALID_MERGE: MergeResult = { ...MERGE_RESULT_STUB, valid: false, errors: ['status: must be string'] };

type FillCase = {
  readonly label: string;
  readonly result: DiffResult | undefined;
  readonly isRunning: boolean;
  readonly merge: MergeResult | undefined;
  readonly expected: string;
};

const FILL_CASES: FillCase[] = [
  { label: 'nothing compared', result: undefined, isRunning: false, merge: undefined, expected: 'Waiting for missing values' },
  { label: 'nothing missing', result: NOTHING_MISSING, isRunning: false, merge: undefined, expected: 'Nothing to fill' },
  { label: 'a run under way', result: WITH_BROKEN, isRunning: true, merge: undefined, expected: 'Filling…' },
  { label: 'values to fill', result: WITH_BROKEN, isRunning: false, merge: undefined, expected: '2 values to fill' },
  { label: 'one value to fill', result: DIFF_RESULT_STUB, isRunning: false, merge: undefined, expected: '1 value to fill' },
  { label: 'a valid merge', result: DIFF_RESULT_STUB, isRunning: false, merge: MERGE_RESULT_STUB, expected: 'Merged · valid' },
  { label: 'an invalid merge', result: DIFF_RESULT_STUB, isRunning: false, merge: INVALID_MERGE, expected: 'Merged · 1 schema error' }
];

describe('FEATURE: step statuses', (): void => {
  describe('GIVEN the missing values step', (): void => {
    it('WHEN nothing is compared THEN waits for a compare', (): void => {
      expect(missingStatus(undefined)).toBe('Waiting for a compare');
    });

    it('WHEN a diff replaced a broken value THEN counts it as broken, not missing', (): void => {
      expect(missingStatus(WITH_BROKEN)).toBe('1 missing · 1 broken');
    });
  });

  describe('GIVEN the AI fill step', (): void => {
    it.each(FILL_CASES)('WHEN $label THEN reads "$expected"', ({ result, isRunning, merge, expected }): void => {
      expect(fillStatus(result, isRunning, merge)).toBe(expected);
    });
  });
});
