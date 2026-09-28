import { beforeAll, describe, expect, it } from 'vitest';

import { missingSample } from './missing-sample.util.ts';
import type { MissingFile } from '../contract/common/studio-api.type.ts';
import { missingFixture } from '../test/utils/studio-spec.spec.util.ts';

const STRING_SCHEMA = { type: 'string' };

describe('FEATURE: missing sample', (): void => {
  let missing: MissingFile;

  beforeAll(async (): Promise<void> => {
    missing = await missingFixture('customer');
  });

  describe('GIVEN a missing projection with a referenced component', (): void => {
    it('WHEN sampled THEN holds exactly the missing keys with resolved references', (): void => {
      const customer = { id: 'cus_1' };

      const sample = missingSample(missing);

      expect(sample).toStrictEqual({ status: 'draft', customer });
    });
  });

  describe('GIVEN a projection that is not an object', (): void => {
    it('WHEN sampled THEN fails', (): void => {
      const shaped: MissingFile = { ...missing, schema: STRING_SCHEMA };

      expect((): unknown => missingSample(shaped)).toThrow();
    });
  });
});
