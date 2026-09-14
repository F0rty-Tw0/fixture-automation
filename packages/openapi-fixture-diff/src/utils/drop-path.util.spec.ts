import { describe, expect, it } from 'vitest';

import { dropPaths } from './drop-path.util.ts';
import { nestedOrder } from '../test/utils/nested-spec.spec.util.ts';

const CORRUPT_CUSTOMER = { name: 'Ada', country: 'NL', vat: 'NL01' };
const CORRUPT_SOURCE = { supplierId: 'sup_1' };
const CORRUPT_FIRST_LINE = { sku: 'sku_1', source: CORRUPT_SOURCE };
const CORRUPT_SECOND_LINE = { source: 'internal' };
const CORRUPT_LINES = [CORRUPT_FIRST_LINE, CORRUPT_SECOND_LINE];
const CORRUPT_ORDER = { created: 1700000000, note: 'first order', customer: CORRUPT_CUSTOMER, lines: CORRUPT_LINES };

const FULL_CUSTOMER = { name: 'Ada', country: 'NL', email: 'ada@example.com', vat: 'NL01' };
const FULL_SECOND_LINE = { sku: 'sku_2', source: 'internal' };
const SPLICED_LINES = [FULL_SECOND_LINE];
const SPLICED_ORDER = { id: 'or_1', created: 1700000000, note: 'first order', customer: FULL_CUSTOMER, lines: SPLICED_LINES };

describe('FEATURE: fixture corruption by dotted path', (): void => {
  describe('GIVEN a fixture holding an empty object', (): void => {
    it('WHEN dropping a key from it THEN it offers no suggestion', (): void => {
      const fixture = { customer: {} };
      const drop = (): unknown => dropPaths(fixture, ['customer.email']);

      expect(drop).toThrow('unknown fixture path "customer.email"');
      expect(drop).toThrow(expect.objectContaining({ fix: undefined }));
    });
  });

  describe('GIVEN a nested fixture with object and array members', (): void => {
    it('WHEN dropping top-level, nested and indexed paths THEN only those keys disappear', async (): Promise<void> => {
      const fixture = await nestedOrder();

      const corrupted = dropPaths(fixture, ['id', 'customer.email', 'lines[0].source.region', 'lines[1].sku']);

      expect(corrupted).toStrictEqual(CORRUPT_ORDER);
    });

    it('WHEN dropping a path THEN the source fixture keeps every key', async (): Promise<void> => {
      const fixture = await nestedOrder();
      const pristine = await nestedOrder();

      dropPaths(fixture, ['customer.email']);

      expect(fixture).toStrictEqual(pristine);
    });

    it('WHEN dropping an array element THEN the later elements shift down', async (): Promise<void> => {
      const fixture = await nestedOrder();

      const corrupted = dropPaths(fixture, ['lines[0]']);

      expect(corrupted).toStrictEqual(SPLICED_ORDER);
    });
  });

  describe('GIVEN paths the fixture does not contain', (): void => {
    it('WHEN dropping an absent key THEN the error names the unknown path', async (): Promise<void> => {
      const fixture = await nestedOrder();

      expect((): unknown => dropPaths(fixture, ['customer.phone'])).toThrow('unknown fixture path "customer.phone"');
    });

    it('WHEN dropping an out-of-range index THEN the error names the unknown path', async (): Promise<void> => {
      const fixture = await nestedOrder();

      expect((): unknown => dropPaths(fixture, ['lines[9].sku'])).toThrow('unknown fixture path "lines[9].sku"');
    });

    it('WHEN dropping a malformed path THEN the error names the invalid path', async (): Promise<void> => {
      const fixture = await nestedOrder();

      expect((): unknown => dropPaths(fixture, ['lines[a]'])).toThrow('invalid fixture path "lines[a]"');
    });
  });
});
