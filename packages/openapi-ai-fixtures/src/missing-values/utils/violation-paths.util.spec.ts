import { describe, expect, it } from 'vitest';

import { violatedPaths, violatingErrors } from './violation-paths.util.ts';
import type { MissingViolation } from '../common/missing.type.ts';

const PATHS = ['id', 'customer.email', 'lines[0].sku', 'lines[1].tax', 'lines[2].quantity'];
const LINE_PATHS = ['lines[0].sku', 'lines[1].tax', 'lines[2].quantity'];
const NO_PARAMS: Record<string, unknown> = {};

const violation = (instancePath: string, keyword: string, params = NO_PARAMS): MissingViolation => {
  const error: MissingViolation = { instancePath, keyword, params, message: keyword };

  return error;
};

const requiredAt = (instancePath: string, missingProperty: string): MissingViolation => {
  const params = { missingProperty };

  return violation(instancePath, 'required', params);
};

describe('FEATURE: violated missing paths', (): void => {
  describe('GIVEN the missing paths of an invoice fill', (): void => {
    it('WHEN a leaf keyword fails below a missing path THEN flags that path', (): void => {
      const errors = [violation('/lines/1/tax/rate', 'type')];

      const paths = violatedPaths(errors, PATHS);

      expect([...paths]).toStrictEqual(['lines[1].tax']);
    });

    it('WHEN a required missing key is absent THEN flags the path it names', (): void => {
      const errors = [requiredAt('', 'id'), requiredAt('/customer', 'email')];

      const paths = violatedPaths(errors, PATHS);

      expect([...paths]).toStrictEqual(['id', 'customer.email']);
    });

    it('WHEN a required key outside the missing paths is absent THEN flags nothing', (): void => {
      const errors = [requiredAt('/lines/0', 'tax')];

      const paths = violatedPaths(errors, PATHS);

      expect([...paths]).toStrictEqual([]);
    });

    it('WHEN a value above missing paths has the wrong type THEN flags every missing path below it', (): void => {
      const errors = [violation('/lines', 'type')];

      const paths = violatedPaths(errors, PATHS);

      expect([...paths]).toStrictEqual(LINE_PATHS);
    });

    it('WHEN an object below a missing path has an extra property THEN flags that path', (): void => {
      const params = { additionalProperty: 'extra' };
      const errors = [violation('/lines/1/tax', 'additionalProperties', params)];

      const paths = violatedPaths(errors, PATHS);

      expect([...paths]).toStrictEqual(['lines[1].tax']);
    });

    it('WHEN an if fails THEN only the then errors flag paths, not the whole value', (): void => {
      const errors = [violation('/lines/1/tax/rate', 'type'), violation('', 'if')];

      const paths = violatedPaths(errors, PATHS);

      expect([...paths]).toStrictEqual(['lines[1].tax']);
    });

    it('WHEN an anyOf fails at a value above missing paths THEN flags every missing path below it', (): void => {
      const errors = [violation('/lines', 'anyOf')];

      const paths = violatedPaths(errors, PATHS);

      expect([...paths]).toStrictEqual(LINE_PATHS);
    });

    it('WHEN there are no errors THEN flags nothing', (): void => {
      const paths = violatedPaths([], PATHS);

      expect([...paths]).toStrictEqual([]);
    });
  });

  describe('GIVEN a verdict mixing errors on missing paths with errors on array holes', (): void => {
    it('WHEN the violating errors are picked THEN keeps only the errors that flag a missing path', (): void => {
      const taxError = violation('/lines/1/tax/rate', 'type');
      const holeError = violation('/lines/3', 'type');
      const errors = [holeError, taxError, requiredAt('/lines/0', 'tax'), violation('', 'if')];

      const violating = violatingErrors(errors, PATHS);

      expect(violating).toStrictEqual([taxError]);
    });
  });
});
