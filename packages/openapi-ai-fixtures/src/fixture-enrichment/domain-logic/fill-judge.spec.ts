import { describe, expect, it } from 'vitest';

import { fillJudge, wrongShapeOf } from './fill-judge.ts';
import type { AgentJson } from '../../agent-provider/common/agent-provider.type.ts';
import { missingPatterns } from '../../missing-patterns/utils/path-pattern.util.ts';
import type { MissingFile, MissingValidator, MissingVerdict } from '../../missing-values/common/missing.type.ts';
import { missingCheck } from '../../missing-values/utils/missing-check.util.ts';

const QUANTITY_SCHEMA = { type: 'integer', minimum: 1 };
const LINE_PROPERTIES = { qty: QUANTITY_SCHEMA };
const LINE_ITEM = { type: 'object', required: ['qty'], properties: LINE_PROPERTIES };
const LINES_SCHEMA = { type: 'array', items: LINE_ITEM };
const ORDER_PROPERTIES = { lines: LINES_SCHEMA };
const ORDER_PROJECTION = { type: 'object', required: ['lines'], properties: ORDER_PROPERTIES };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const COMPONENTS = { schemas: EMPTY_SCHEMAS };
const PATHS = ['lines[1].qty'];
const MISSING: MissingFile = { schemaName: 'order', dialect: 'openapi-30', paths: PATHS, schema: ORDER_PROJECTION, components: COMPONENTS };
const LIST_MISSING: MissingFile = { ...MISSING, paths: ['[0].status'] };
const PATTERNS = missingPatterns(PATHS);
const FILL_JSON = '{"lines":[null,{"qty":2}]}';

const parsedAs = (value: unknown, alternatives: unknown[]): AgentJson => {
  const parsed: AgentJson = { value, isRecovered: alternatives.length > 0, alternatives };

  return parsed;
};

const inProcess = (missing: MissingFile): MissingValidator => {
  const check = missingCheck(missing);
  const validate = async (_missing: MissingFile, value: unknown): Promise<MissingVerdict> => Promise.resolve(check(value));

  return validate;
};

describe('FEATURE: judge a pattern answer against the missing projection', (): void => {
  describe('GIVEN a missing quantity on the second line only', (): void => {
    it('WHEN the pattern answer fits THEN the sparse fill is accepted despite the hole', async (): Promise<void> => {
      const answer = { 'lines[*].qty': [2] };
      const judge = fillJudge(MISSING, inProcess(MISSING), PATTERNS);

      const problem = await judge.check(answer, parsedAs(answer, []));

      expect(problem).toBeUndefined();
      expect(JSON.stringify(judge.accepted())).toBe(FILL_JSON);
    });

    it('WHEN the answer breaks the requested path THEN names only that error', async (): Promise<void> => {
      const answer = { 'lines[*].qty': [0] };
      const judge = fillJudge(MISSING, inProcess(MISSING), PATTERNS);

      const problem = await judge.check(answer, parsedAs(answer, []));

      expect(problem).toBe('/lines/1/qty: must be >= 1');
    });

    it('WHEN the chosen value fails but an alternative fits THEN accepts the alternative', async (): Promise<void> => {
      const chosen = { 'lines[*].qty': [0] };
      const alternative = { 'lines[*].qty': [2] };
      const judge = fillJudge(MISSING, inProcess(MISSING), PATTERNS);

      const problem = await judge.check(chosen, parsedAs(chosen, [alternative]));

      expect(problem).toBeUndefined();
      expect(JSON.stringify(judge.accepted())).toBe(FILL_JSON);
      expect(judge.candidates).toHaveLength(2);
    });

    it('WHEN the validator says invalid without errors THEN returns its details', async (): Promise<void> => {
      const verdict: MissingVerdict = { valid: false, details: 'rejected upstream', errors: [] };
      const validate: MissingValidator = async (): Promise<MissingVerdict> => Promise.resolve(verdict);
      const answer = { 'lines[*].qty': [2] };
      const judge = fillJudge(MISSING, validate, PATTERNS);

      const problem = await judge.check(answer, parsedAs(answer, []));

      expect(problem).toBe('rejected upstream');
    });
  });

  describe('GIVEN the wrong shape message', (): void => {
    it('WHEN the paths fill an object THEN asks for one object', (): void => {
      const message = wrongShapeOf(MISSING);

      expect(message).toBe('the fill must be one JSON object');
    });

    it('WHEN the paths fill a list THEN asks for one array', (): void => {
      const message = wrongShapeOf(LIST_MISSING);

      expect(message).toBe('the fill must be one JSON array');
    });
  });
});
