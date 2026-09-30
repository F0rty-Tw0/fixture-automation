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
const NOTE_SCHEMA = { type: 'string' };
const MIXED_PROPERTIES = { qty: QUANTITY_SCHEMA, note: NOTE_SCHEMA };
const MIXED_ITEM = { type: 'object', required: ['qty', 'note'], properties: MIXED_PROPERTIES };
const MIXED_LINES = { type: 'array', items: MIXED_ITEM };
const MIXED_ORDER_PROPERTIES = { lines: MIXED_LINES };
const MIXED_PROJECTION = { type: 'object', required: ['lines'], properties: MIXED_ORDER_PROPERTIES };
const MIXED_PATHS = ['lines[0].qty', 'lines[1].note'];
const MIXED_MISSING: MissingFile = { ...MISSING, paths: MIXED_PATHS, schema: MIXED_PROJECTION };
const MIXED_PATTERNS = missingPatterns(MIXED_PATHS);
const QTY_ONLY_LINES = [{ qty: 2 }];
const QTY_ONLY_ANSWER = { lines: QTY_ONLY_LINES };

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

    it('WHEN a concrete answer also writes an item the diff never reported THEN only the missing path is accepted', async (): Promise<void> => {
      const lines = [{}, { qty: 1 }, { qty: 'bad' }, { junk: true }];
      const answer = { lines };
      const judge = fillJudge(MISSING, inProcess(MISSING), PATTERNS);

      const problem = await judge.check(answer, parsedAs(answer, []));

      expect(problem).toBeUndefined();
      expect(JSON.stringify(judge.accepted())).toBe('{"lines":[null,{"qty":1}]}');
    });

    it('WHEN the validator passes a value of the wrong shape THEN names the shape', async (): Promise<void> => {
      const verdict: MissingVerdict = { valid: true, details: '', errors: [] };
      const validate: MissingValidator = async (): Promise<MissingVerdict> => Promise.resolve(verdict);
      const judge = fillJudge(MISSING, validate, PATTERNS);

      const problem = await judge.check(7, parsedAs(7, []));

      expect(problem).toBe('the fill must be one JSON object');
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

  describe('GIVEN a quantity missing on the first line and a note on the second', (): void => {
    it.each<[string, unknown]>([
      ['a pattern answer', { 'lines[*].qty': [2] }],
      ['a pattern answer with no note examples', { 'lines[*].qty': [2], 'lines[*].note': [] }],
      ['a concrete answer', QTY_ONLY_ANSWER]
    ])('WHEN %s leaves the note out THEN names the path with no value', async (_label: string, answer: unknown): Promise<void> => {
      const judge = fillJudge(MIXED_MISSING, inProcess(MIXED_MISSING), MIXED_PATTERNS);

      const problem = await judge.check(answer, parsedAs(answer, []));

      expect(problem).toBe('no value for lines[1].note');
    });

    it('WHEN the chosen value leaves the note out but an alternative has both THEN accepts the alternative trimmed', async (): Promise<void> => {
      const chosen = { 'lines[*].qty': [2] };
      const lines = [{ qty: 2, note: 'extra' }, { note: 'n', qty: 9 }];
      const alternative = { id: 'extra', lines };
      const judge = fillJudge(MIXED_MISSING, inProcess(MIXED_MISSING), MIXED_PATTERNS);

      const problem = await judge.check(chosen, parsedAs(chosen, [alternative]));

      expect(problem).toBeUndefined();
      expect(JSON.stringify(judge.accepted())).toBe('{"lines":[{"qty":2},{"note":"n"}]}');
    });
  });

  describe('GIVEN seven missing quantities', (): void => {
    it('WHEN the answer has none of them THEN names the first five and counts the rest', async (): Promise<void> => {
      const paths = ['lines[0].qty', 'lines[1].qty', 'lines[2].qty', 'lines[3].qty', 'lines[4].qty', 'lines[5].qty', 'lines[6].qty'];
      const missing: MissingFile = { ...MISSING, paths };
      const lines: unknown[] = [];
      const answer = { lines };
      const judge = fillJudge(missing, inProcess(missing), missingPatterns(paths));

      const problem = await judge.check(answer, parsedAs(answer, []));

      expect(problem).toBe('no value for lines[0].qty, lines[1].qty, lines[2].qty, lines[3].qty, lines[4].qty and 2 more');
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
