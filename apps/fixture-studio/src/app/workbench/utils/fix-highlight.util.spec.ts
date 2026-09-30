import type { BrokenValue, DiffResult, FillSource } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { brokenHighlights, errorHighlights, payloadEnvelope, targetHighlights } from './fix-highlight.util.ts';
import type { FixOrigin, PathHighlight } from '../../shared/document-view/common/document-view.type.ts';
import { DIFF_RESULT_STUB } from '../../test/stubs/studio.stub.ts';

const BROKEN_AMOUNT: BrokenValue = { path: 'amount', value: 0, reason: 'openapi-sampler placeholder' };
const BROKEN_DATE: BrokenValue = { path: 'due', value: 'soon', reason: 'must match format "date"' };

/** `memo` is absent, `amount` was replaced; `due` is broken but kept, so no fill targets it. */
const DIFF: DiffResult = {
  ...DIFF_RESULT_STUB,
  missingPaths: ['memo', 'amount'],
  replacedPaths: ['amount'],
  broken: [BROKEN_AMOUNT, BROKEN_DATE]
};

/** Like `DIFF`, plus an absent `customer.address.city`. */
const NESTED_DIFF: DiffResult = { ...DIFF, missingPaths: [...DIFF.missingPaths, 'customer.address.city'] };

type ErrorCase = {
  readonly label: string;
  readonly error: string;
  readonly objectShape: string | undefined;
  readonly path: string;
  readonly origin: FixOrigin;
};

const ERROR_CASES: ErrorCase[] = [
  {
    label: 'a pointer under an absent target',
    error: '/memo: must be string',
    objectShape: undefined,
    path: '/memo',
    origin: 'missing'
  },
  {
    label: 'a pointer at the parent of an absent target',
    error: '/customer: must have required property city',
    objectShape: undefined,
    path: '/customer',
    origin: 'missing'
  },
  {
    label: 'a pointer inside an envelope',
    error: '/amount: must be integer',
    objectShape: 'data',
    path: '/data/amount',
    origin: 'broken'
  },
  { label: 'a dotted path', error: 'lines[0].sku: must be string', objectShape: undefined, path: 'lines[0].sku', origin: 'broken' },
  {
    label: 'a pointer into a root array',
    error: '/1/created: must be integer',
    objectShape: undefined,
    path: '/1/created',
    origin: 'broken'
  },
  { label: 'a pointer to a key holding a dot', error: '/a.b: must be string', objectShape: undefined, path: '/a.b', origin: 'broken' },
  {
    label: 'a pointer inside an envelope with a slash',
    error: '/id: must be string',
    objectShape: 'a/b',
    path: '/a~1b/id',
    origin: 'broken'
  }
];

describe('FEATURE: fix highlights', (): void => {
  describe('GIVEN a diff with an absent, a replaced and a kept broken value', (): void => {
    it('WHEN no source is known THEN every target takes the fallback source and the kept one stays broken', (): void => {
      const expected: PathHighlight[] = [
        { path: 'memo', origin: 'missing', outcome: 'sampler' },
        { path: 'amount', origin: 'broken', outcome: 'sampler' },
        { path: 'due', origin: 'broken', outcome: 'unfilled' }
      ];

      expect(targetHighlights(DIFF, {}, 'sampler')).toStrictEqual(expected);
    });

    it('WHEN the fill names each source THEN each target shows its own', (): void => {
      const sources: Record<string, FillSource> = { memo: 'ai', amount: 'unfilled' };

      const outcomes = targetHighlights(DIFF, sources, 'ai').map((highlight) => highlight.outcome);

      expect(outcomes).toStrictEqual(['ai', 'unfilled', 'unfilled']);
    });

    it('WHEN the existing fixture is highlighted THEN marks every broken value', (): void => {
      const paths = brokenHighlights(DIFF).map((highlight) => `${highlight.path}:${highlight.outcome}`);

      expect(paths).toStrictEqual(['amount:broken', 'due:broken']);
    });
  });

  describe('GIVEN merge errors', (): void => {
    it.each(ERROR_CASES)('WHEN $label is read THEN highlights it as still broken', ({ error, objectShape, path, origin }): void => {
      const expected: PathHighlight = { path, origin, outcome: 'unfilled' };

      expect(errorHighlights([error], NESTED_DIFF, objectShape)).toStrictEqual([expected]);
    });

    it.each([
      ['no path', 'something odd'],
      ['the root', '/: must have required property memo']
    ])('WHEN an error names %s THEN highlights nothing', (_label, error): void => {
      expect(errorHighlights([error], NESTED_DIFF, undefined)).toStrictEqual([]);
    });
  });

  describe('GIVEN the envelope the compare was asked for', (): void => {
    const DATA = { id: 'in_1' };

    it.each([
      ['a fixture holding it, named with stray spaces', { data: DATA }, ' data ', 'data'],
      ['a fixture without it', { id: 'in_1' }, 'data', undefined],
      ['a list fixture', [DATA], 'data', undefined],
      ['no envelope', { data: DATA }, undefined, undefined],
      ['a blank envelope', { data: DATA }, '  ', undefined]
    ])('WHEN %s is checked THEN names the envelope merge errors sit under', (_label, fixture, objectShape, expected): void => {
      expect(payloadEnvelope(fixture, objectShape)).toBe(expected);
    });
  });
});
