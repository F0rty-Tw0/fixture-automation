import type { AiFillResultEvent, FillSource, MissingFile } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { salvagedAnswer } from './answer-salvage.util.ts';
import { pathSegments, valueAt } from '../../shared/json/utils/json-path.util.ts';
import { MISSING_FILE_STUB } from '../../test/stubs/studio.stub.ts';
import type { SalvageSource } from '../common/ai-fill.type.ts';

const MISSING: MissingFile = { ...MISSING_FILE_STUB, paths: ['memo', 'customer.id', 'lines[0].sku'] };
const COMPLETE_CUSTOMER = { id: 'cus_sampled' };
const COMPLETE_LINE = { sku: 'SKU-1' };
const COMPLETE = { memo: 'string', customer: COMPLETE_CUSTOMER, lines: [COMPLETE_LINE] };
const SOURCE: SalvageSource = { missing: MISSING, complete: COMPLETE };

describe('FEATURE: salvaging an on-device answer', (): void => {
  describe('GIVEN an answer with every missing value', (): void => {
    it('WHEN salvaged THEN keeps it and credits AI for each path', (): void => {
      const customer = { id: 'cus_42' };
      const line = { sku: 'A-1' };
      const answer = { memo: 'Net 30', customer, lines: [line] };
      const sources: Record<string, FillSource> = { memo: 'ai', 'customer.id': 'ai', 'lines[0].sku': 'ai' };
      const expected: AiFillResultEvent = { type: 'result', populated: answer, sources, notes: [] };

      expect(salvagedAnswer(answer, SOURCE, [])).toStrictEqual(expected);
    });
  });

  describe('GIVEN an answer missing some values', (): void => {
    it('WHEN salvaged THEN fills them from the complete fixture and notes it', (): void => {
      const answer = { memo: 'Net 30' };

      const salvaged = salvagedAnswer(answer, SOURCE, ['The second half failed.']);

      expect(salvaged.populated).toStrictEqual({ memo: 'Net 30', customer: COMPLETE_CUSTOMER, lines: [COMPLETE_LINE] });
      expect(salvaged.sources).toStrictEqual({ memo: 'ai', 'customer.id': 'sampler', 'lines[0].sku': 'sampler' });
      expect(salvaged.notes).toStrictEqual([
        'The second half failed.',
        "The on-device model did not answer 2 of 3 values; the schema's sample values stand in for them."
      ]);
    });
  });

  describe('GIVEN no usable answer and no sample for a path', (): void => {
    it('WHEN salvaged THEN leaves that path unfilled', (): void => {
      const complete = { memo: 'string' };
      const source: SalvageSource = { missing: MISSING, complete };

      const salvaged = salvagedAnswer('not an object', source, []);

      expect(salvaged.populated).toStrictEqual({ memo: 'string' });
      expect(salvaged.sources).toStrictEqual({ memo: 'sampler', 'customer.id': 'unfilled', 'lines[0].sku': 'unfilled' });
    });
  });

  describe('GIVEN a list fixture whose root is an array', (): void => {
    const first = { id: 'in_1', created: 1 };
    const secondSampled = { id: 'in_2', created: 0 };
    const listMissing: MissingFile = { ...MISSING_FILE_STUB, paths: ['[0].created', '[1].created'] };
    const listSource: SalvageSource = { missing: listMissing, complete: [first, secondSampled] };

    it('WHEN the answer is a list missing one item value THEN keeps the answered one and samples the other', (): void => {
      const answeredFirst = { created: 7 };
      const answer = [answeredFirst];

      const salvaged = salvagedAnswer(answer, listSource, []);

      expect(salvaged.populated).toStrictEqual([answeredFirst, { created: 0 }]);
      expect(salvaged.sources).toStrictEqual({ '[0].created': 'ai', '[1].created': 'sampler' });
    });

    it('WHEN there is no usable answer THEN builds a list from the samples', (): void => {
      const salvaged = salvagedAnswer(undefined, listSource, []);

      expect(salvaged.populated).toStrictEqual([{ created: 1 }, { created: 0 }]);
    });
  });

  describe('GIVEN an answer whose root is not shaped like the fixture', (): void => {
    const memoMissing: MissingFile = { ...MISSING_FILE_STUB, paths: ['memo'] };
    const sampledMemo = { memo: 's' };
    const objectSource: SalvageSource = { missing: memoMissing, complete: sampledMemo };
    const listMissing: MissingFile = { ...MISSING_FILE_STUB, paths: ['[0].created'] };
    const sampledItem = { created: 1 };
    const listSource: SalvageSource = { missing: listMissing, complete: [sampledItem] };

    it('WHEN a list answers an object fixture THEN starts from an object and samples its values', (): void => {
      const salvaged = salvagedAnswer([{ memo: 'x' }], objectSource, []);

      expect(salvaged.populated).toStrictEqual({ memo: 's' });
      expect(salvaged.sources).toStrictEqual({ memo: 'sampler' });
    });

    it('WHEN an object answers a list fixture THEN starts from a list and samples its values', (): void => {
      const salvaged = salvagedAnswer({ created: 5 }, listSource, []);

      expect(salvaged.populated).toStrictEqual([{ created: 1 }]);
    });
  });

  describe('GIVEN answers of every shape', (): void => {
    const listAnswer = [{ memo: 'x' }];
    const LINE_AS_OBJECT = { sku: 'A-1' };
    const answers: [string, unknown][] = [
      ['no answer', undefined],
      ['prose', 'prose'],
      ['an empty object', {}],
      ['an empty list', []],
      ['a list', listAnswer],
      ['a partial object', { memo: 'Net 30' }],
      ['a scalar where an object belongs', { customer: 'not an object' }],
      ['an object where a list belongs', { lines: LINE_AS_OBJECT }]
    ];

    it.each(answers)('WHEN %s is salvaged THEN every path credited to AI or the sampler holds a value', (_label, answer): void => {
      const salvaged = salvagedAnswer(answer, SOURCE, []);
      const sources = salvaged.sources ?? {};
      const credited = Object.keys(sources).filter((path) => sources[path] !== 'unfilled');
      const missingValues = credited.filter((path) => valueAt(salvaged.populated, pathSegments(path)) === undefined);

      expect(missingValues).toStrictEqual([]);
    });
  });
});
