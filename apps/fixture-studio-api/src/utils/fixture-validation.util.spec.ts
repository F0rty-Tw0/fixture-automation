import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { beforeAll, describe, expect, it } from 'vitest';

import { validationErrors } from './fixture-validation.util.ts';
import { studioSpec } from '../test/utils/studio-spec.spec.util.ts';

describe('FEATURE: fixture validation', (): void => {
  let spec: OpenApiSpec;

  beforeAll(async (): Promise<void> => {
    spec = await studioSpec();
  });

  describe('GIVEN the invoice schema', (): void => {
    it('WHEN the value conforms THEN lists no errors', (): void => {
      const invoice = { id: 'in_1', amount_due: 1, status: 'open' };

      const errors = validationErrors(spec, 'invoice', invoice);

      expect(errors).toStrictEqual([]);
    });

    it('WHEN a nested value violates it THEN lists path: message', (): void => {
      const invoice = { id: 'in_1', amount_due: 1, status: 'closed' };

      const errors = validationErrors(spec, 'invoice', invoice);

      expect(errors).toStrictEqual(['/status: must be equal to one of the allowed values']);
    });

    it('WHEN the root violates it THEN the path is /', (): void => {
      const errors = validationErrors(spec, 'invoice', 'nope');

      expect(errors).toStrictEqual(['/: must be object']);
    });
  });
});
