import type { DiffBody } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { isSameDiffRequest } from './diff-request.util.ts';
import type { DiffRequest } from '../common/comparison.type.ts';

const FIXTURE = { id: 'in_1' };

const BODY: DiffBody = {
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  requiredOnly: false,
  objectShape: undefined,
  replacePlaceholders: true
};

const REQUEST: DiffRequest = { specId: 'spec-1', body: BODY };

const REREAD_FIXTURE = { ...FIXTURE };

describe('FEATURE: diff request identity', (): void => {
  it('GIVEN the same spec, endpoint, fixture and options WHEN compared THEN is the same request', (): void => {
    const body: DiffBody = { ...BODY };
    const copy: DiffRequest = { ...REQUEST, body };

    expect(isSameDiffRequest(REQUEST, copy)).toBe(true);
  });

  it('GIVEN no earlier request WHEN compared THEN is a different request', (): void => {
    expect(isSameDiffRequest(REQUEST, undefined)).toBe(false);
  });

  it('GIVEN another spec WHEN compared THEN is a different request', (): void => {
    const otherSpec: DiffRequest = { ...REQUEST, specId: 'spec-2' };

    expect(isSameDiffRequest(REQUEST, otherSpec)).toBe(false);
  });

  it.each<[string, Partial<DiffBody>]>([
    ['endpoint', { endpointId: 'POST /v1/invoices' }],
    ['required-only option', { requiredOnly: true }],
    ['envelope', { objectShape: 'data' }],
    ['replace option', { replacePlaceholders: false }],
    ['fixture read again, even with equal content', { fixture: REREAD_FIXTURE }]
  ])('GIVEN another %s WHEN compared THEN is a different request', (_change, bodyChange): void => {
    const body: DiffBody = { ...BODY, ...bodyChange };
    const changed: DiffRequest = { ...REQUEST, body };

    expect(isSameDiffRequest(REQUEST, changed)).toBe(false);
  });
});
