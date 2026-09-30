import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aiMissingFixture } from './ai-missing-fixtures.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { AiMissingRequest, MissingFile } from '../../missing-values/common/missing.type.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { agentResponse } from '../../test/utils/agent-response.spec.util.ts';
import { AiFillRejectedError } from '../common/ai-fill-rejected.error.ts';

vi.mock('../../agent-process/data-access/agent-process.client.ts');

const SCENARIO = 'Fill the absent order fields.';
const STRING_SCHEMA = { type: 'string' };
const QUANTITY_SCHEMA = { type: 'integer', minimum: 1 };
const SKU_SCHEMA = { type: 'string', pattern: '^SKU-' };
const EMAIL_PROPERTIES = { email: STRING_SCHEMA };
const CUSTOMER_SCHEMA = { type: 'object', required: ['email'], properties: EMAIL_PROPERTIES };
const SKU_PROPERTIES = { sku: SKU_SCHEMA };
const SKU_ITEM = { type: 'object', required: ['sku'], properties: SKU_PROPERTIES };
const SKU_LINES = { type: 'array', items: SKU_ITEM };
const ORDER_PROPERTIES = { id: STRING_SCHEMA, customer: CUSTOMER_SCHEMA, lines: SKU_LINES };
const ORDER_PROJECTION = { type: 'object', required: ['id', 'customer', 'lines'], properties: ORDER_PROPERTIES };
const LINE_PROPERTIES = { qty: QUANTITY_SCHEMA, sku: SKU_SCHEMA };
const LINE_ITEM = { type: 'object', required: ['qty', 'sku'], properties: LINE_PROPERTIES };
const LINES_SCHEMA = { type: 'array', items: LINE_ITEM };
const LINES_PROPERTIES = { lines: LINES_SCHEMA };
const LINES_PROJECTION = { type: 'object', required: ['lines'], properties: LINES_PROPERTIES };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const COMPONENTS = { schemas: EMPTY_SCHEMAS };
const ORDER_PATHS = ['id', 'customer.email', 'lines[1].sku'];
const ORDER_ANSWER = { id: ['ord_1'], 'customer.email': ['buyer@example.com'], 'lines[*].sku': ['SKU-{n}'] };
const BAD_ID_ANSWER = { id: [7], 'customer.email': ['buyer@example.com'], 'lines[*].sku': ['SKU-{n}'] };
const MIXED_ANSWER = { 'lines[*].qty': [2], 'lines[*].sku': ['SKU-{n}'] };
const ORDER_FILL_JSON = '{"id":"ord_1","customer":{"email":"buyer@example.com"},"lines":[null,{"sku":"SKU-1"}]}';
const FIRST_LINE = { sku: 'SKU-0', qty: 1 };
const ORDER_CUSTOMER = { name: 'Ada' };
const ORDER_LINES = [FIRST_LINE, { qty: 2 }];
const ORDER_FIXTURE = { customer: ORDER_CUSTOMER, lines: ORDER_LINES };
const LINES_FIXTURE_LINES = [{ sku: 'SKU-0' }, { qty: 3 }];
const LINES_FIXTURE = { lines: LINES_FIXTURE_LINES };
const OPTIONS: AiFixtureOptions = { tool: 'claude', timeoutMs: 10000 };

const missingFile = (paths: string[], schema: unknown): MissingFile => {
  const missing: MissingFile = { schemaName: 'order', dialect: 'openapi-30', paths, schema, components: COMPONENTS };

  return missing;
};

const ORDER_MISSING = missingFile(ORDER_PATHS, ORDER_PROJECTION);
const ORDER_REQUEST: AiMissingRequest = { fixture: ORDER_FIXTURE, missing: ORDER_MISSING, scenario: SCENARIO };

const answer = (value: unknown): string => agentResponse('claude', JSON.stringify(value));

const rejection = async (filling: Promise<unknown>): Promise<AiFillRejectedError> => {
  try {
    await filling;
  } catch (error: unknown) {
    if (error instanceof AiFillRejectedError) return error;

    throw error;
  }

  throw new Error('the fill did not reject');
};

describe('FEATURE: AI fill of missing fields at sparse array indices', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN an order missing its id, customer email and second line sku', (): void => {
    it('WHEN the harness answers by pattern THEN the sparse fill is accepted in one run', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(answer(ORDER_ANSWER));

      const result = await aiMissingFixture(OPTIONS)('order', ORDER_REQUEST);

      expect(JSON.stringify(result)).toBe(ORDER_FILL_JSON);
      expect(runAgent).toHaveBeenCalledTimes(1);
    });

    it('WHEN the answer breaks a requested path THEN rejects with only that path in the problem', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(answer(BAD_ID_ANSWER));

      const error = await rejection(aiMissingFixture(OPTIONS)('order', ORDER_REQUEST));

      expect(error.problem).toBe('/id: must be string');
      expect(runAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('GIVEN lines where one lacks a quantity and another a sku', (): void => {
    it('WHEN the harness answers by pattern THEN the fill is accepted although no line holds both', async (): Promise<void> => {
      const missing = missingFile(['lines[0].qty', 'lines[1].sku'], LINES_PROJECTION);
      const request: AiMissingRequest = { fixture: LINES_FIXTURE, missing, scenario: SCENARIO };
      const lines = [{ qty: 2 }, { sku: 'SKU-1' }];

      vi.mocked(runAgent).mockResolvedValue(answer(MIXED_ANSWER));

      const result = await aiMissingFixture(OPTIONS)('order', request);

      expect(result).toStrictEqual({ lines });
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });
});
