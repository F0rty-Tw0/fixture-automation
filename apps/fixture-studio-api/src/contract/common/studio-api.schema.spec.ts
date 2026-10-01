import { HTTP_METHODS } from '@fixture-automation/openapi-fixture-merge';
import { describe, expect, it } from 'vitest';

import { fixtureNameQuerySchema } from './studio-api.schema.ts';

/** Every method RFC 9110 and RFC 5789 define, plus anything the merge CLI adds, so drift on either side shows up. */
const STANDARD_METHODS = ['connect', 'delete', 'get', 'head', 'options', 'patch', 'post', 'put', 'trace'];
const CANDIDATE_SET = new Set([...STANDARD_METHODS, ...HTTP_METHODS]);
const CANDIDATE_METHODS = [...CANDIDATE_SET];

const isAccepted = (method: string): boolean => {
  const query = { method, url: 'v1/invoices' };

  return fixtureNameQuerySchema.safeParse(query).success;
};

describe('FEATURE: studio API schema', (): void => {
  describe('GIVEN the fixture name query', (): void => {
    it('WHEN methods are checked in lower case THEN accepts exactly the merge CLI HTTP_METHODS', (): void => {
      const methods: string[] = [...HTTP_METHODS];

      const accepted = CANDIDATE_METHODS.filter(isAccepted);

      expect(accepted.toSorted()).toStrictEqual(methods.toSorted());
    });

    it('WHEN methods are checked in upper case THEN accepts exactly the merge CLI HTTP_METHODS', (): void => {
      const upperCandidates = CANDIDATE_METHODS.map((method) => method.toUpperCase());
      const upperMethods = HTTP_METHODS.map((method) => method.toUpperCase());

      const accepted = upperCandidates.filter(isAccepted);

      expect(accepted.toSorted()).toStrictEqual(upperMethods.toSorted());
    });
  });
});
