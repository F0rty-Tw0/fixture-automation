import { describe, expect, it } from 'vitest';

import { closedProjection } from './closed-projection.util.ts';

const STATUS = { type: 'string', enum: ['open', 'paid'] };
const CITY = { type: 'string' };
const ADDRESS_PROPERTIES = { city: CITY };
const ADDRESS = { type: 'object', properties: ADDRESS_PROPERTIES };
const CUSTOMER_PROPERTIES = { address: ADDRESS };
const CUSTOMER = { type: 'object', required: ['address'], properties: CUSTOMER_PROPERTIES };
const TOP_PROPERTIES = { status: STATUS, customer: CUSTOMER };
const TOP = { type: 'object', required: ['status', 'customer'], properties: TOP_PROPERTIES };

const INTENT_PROPERTIES = { customer: STATUS };
const INTENT = { type: 'object', required: ['customer'], properties: INTENT_PROPERTIES };
const CLOSED_INTENT = { ...INTENT, additionalProperties: false };
const ERROR_PROPERTIES = { intent: INTENT };
const CLOSED_ERROR_PROPERTIES = { intent: CLOSED_INTENT };
const ERROR = { type: 'object', required: ['intent'], properties: ERROR_PROPERTIES };
const CLOSED_ERROR = { ...ERROR, additionalProperties: false, properties: CLOSED_ERROR_PROPERTIES };
const NESTED_PROPERTIES = { error: ERROR };
const CLOSED_NESTED_PROPERTIES = { error: CLOSED_ERROR };
const NESTED = { type: 'object', required: ['error'], properties: NESTED_PROPERTIES };

const LINE_PROPERTIES = { tax: CITY };
const LINE = { type: 'object', required: ['tax'], properties: LINE_PROPERTIES };
const CLOSED_LINE = { ...LINE, additionalProperties: false };
const LINES = { type: 'array', items: LINE };
const CLOSED_LINES = { ...LINES, items: CLOSED_LINE };
const WITH_LINES_PROPERTIES = { lines: LINES };
const CLOSED_WITH_LINES_PROPERTIES = { lines: CLOSED_LINES };
const WITH_LINES = { type: 'object', required: ['lines'], properties: WITH_LINES_PROPERTIES };

describe('FEATURE: closed missing projection', (): void => {
  it('GIVEN top-level missing keys WHEN closed THEN the root forbids other keys and the leaves stay as they were', (): void => {
    const closed = closedProjection(TOP, ['status', 'customer']);

    expect(closed).toStrictEqual({ ...TOP, additionalProperties: false });
  });

  it('GIVEN a nested missing key WHEN closed THEN every object on its way is closed', (): void => {
    const closed = closedProjection(NESTED, ['error.intent.customer']);

    expect(closed).toStrictEqual({ ...NESTED, additionalProperties: false, properties: CLOSED_NESTED_PROPERTIES });
  });

  it('GIVEN a missing key inside array items WHEN closed THEN closes the item object', (): void => {
    const closed = closedProjection(WITH_LINES, ['lines[0].tax']);

    expect(closed).toStrictEqual({ ...WITH_LINES, additionalProperties: false, properties: CLOSED_WITH_LINES_PROPERTIES });
  });

  it('GIVEN a projection WHEN closed THEN leaves the input unchanged', (): void => {
    closedProjection(TOP, ['status']);

    expect(TOP).not.toHaveProperty('additionalProperties');
  });
});
