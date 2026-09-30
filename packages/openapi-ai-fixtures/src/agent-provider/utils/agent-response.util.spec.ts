import { describe, expect, it } from 'vitest';

import { parseAgentEnvelope, readAgentJson } from './agent-response.util.ts';
import type { AiTool } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { AgentJsonError } from '../common/agent-json.error.ts';

const QUANTITY_LINES = [{}, {}, { quantity: 3 }];
const PADDED_LINES = { lines: QUANTITY_LINES };

const answerOf = (text: string, tool: AiTool): unknown => readAgentJson(text, tool).value;

describe('FEATURE: coding tool JSON responses', (): void => {
  describe('GIVEN one complete JSON code fence', (): void => {
    it('WHEN parsing a labelled response THEN preserves the enclosed JSON value', (): void => {
      const response = '```json\n{"id":"example","memo":"Keep ```json and ``` inside strings"}\n```';

      const value = answerOf(response, 'gemini');

      expect(value).toStrictEqual({ id: 'example', memo: 'Keep ```json and ``` inside strings' });
    });

    it('WHEN parsing an unlabelled CRLF response THEN accepts surrounding whitespace', (): void => {
      const response = ' \r\n```\r\n[1,false,null]\r\n```\r\n\t';

      const value = answerOf(response, 'gemini');

      expect(value).toStrictEqual([1, false, null]);
    });

    it('WHEN an enclosed number overflows THEN rejects it rather than weakening JSON validation', (): void => {
      expect((): unknown => answerOf('```json\n{"amount":1e400}\n```', 'gemini')).toThrow(AgentJsonError);
    });
  });

  describe('GIVEN a plain JSON response', (): void => {
    it('WHEN read in full THEN it is not recovered and has no alternatives', (): void => {
      const parsed = readAgentJson('{"id":"in_1"}', 'claude');

      const value = { id: 'in_1' };

      expect(parsed).toStrictEqual({ value, isRecovered: false, alternatives: [] });
    });
  });

  describe('GIVEN plain JSON containing literal code-fence text', (): void => {
    it('WHEN parsing THEN leaves string contents unchanged', (): void => {
      const response = '{"memo":"```json\\n{}\\n```"}';

      const value = answerOf(response, 'gemini');

      expect(value).toStrictEqual({ memo: '```json\n{}\n```' });
    });
  });

  describe('GIVEN JSON wrapped in prose or Markdown', (): void => {
    it.each<[string, unknown]>([
      ['Here is the result:\n```json\n{"id":"example"}\n```', { id: 'example' }],
      ['```json\n{"id":"example"}\n```\nExplanation follows.', { id: 'example' }],
      ['```json\n{"id":"first"}\n```\n```json\n{"id":"second"}\n```', { id: 'first' }],
      ['I filled lines[2].quantity and customer.email:\n{"lines":[{},{},{"quantity":3}]}', PADDED_LINES],
      ['Per the spec [1], here it is: {"id":"in_1"}', { id: 'in_1' }],
      ['x [2] y {"a":1} z {"b":2,"c":3}', { b: 2, c: 3 }],
      ['Example:\n```ts\nconst a = 1;\n```\n{"id":"x"}', { id: 'x' }],
      ['Here:\n```\n[1]\n```\nand the answer {"id":"x"}', { id: 'x' }],
      ['```json\n{"id":}\n```\nFixed:\n```json\n{"id":"second"}\n```', { id: 'second' }],
      ['```javascript\n{"id":"example"}\n```', { id: 'example' }],
      ['```json\n{"id":"example"}', { id: 'example' }],
      ['{"id":"example"} explanation', { id: 'example' }],
      ['The fill is {"memo":"a } and { inside","n":1}. Done.', { memo: 'a } and { inside', n: 1 }],
      ['Values: [1,2,3] as asked', [1, 2, 3]],
      ['Draft {not json} then the answer {"id":"last"}', { id: 'last' }]
    ])('WHEN parsing %j THEN extracts the enclosed JSON value', (response: string, expected: unknown): void => {
      const value = answerOf(response, 'gemini');

      expect(value).toStrictEqual(expected);
    });

    it('WHEN the only JSON in the prose is empty THEN rejects it as no answer', (): void => {
      expect((): unknown => answerOf('I cannot complete this request {} sorry.', 'claude')).toThrow(AgentJsonError);
    });

    it('WHEN read in full THEN marks the value recovered and keeps the other candidates, best first', (): void => {
      const parsed = readAgentJson('Per the spec [1] and [2, 3], here it is: {"id":"in_1"}', 'claude');

      const value = { id: 'in_1' };
      const alternatives = [[2, 3], [1]];

      expect(parsed).toStrictEqual({ value, isRecovered: true, alternatives });
    });

    it('WHEN every enclosed number overflows THEN still rejects it', (): void => {
      expect((): unknown => answerOf('Result: {"amount":1e400}', 'gemini')).toThrow(AgentJsonError);
    });
  });

  describe('GIVEN a non-JSON model response', (): void => {
    it('WHEN parsing malformed JSON inside a fence THEN preserves the original response on the error', (): void => {
      const response = '```json\n{"id":}\n```';
      let error: unknown;

      try {
        answerOf(response, 'claude');
      } catch (cause: unknown) {
        error = cause;
      }

      expect(error).toBeInstanceOf(AgentJsonError);

      if (!(error instanceof AgentJsonError)) throw error;

      expect(error.response).toBe(response);
      expect(error.cause).toBeInstanceOf(Error);
    });

    it.each(['I could not produce the fixture.', '{"id":', '{"id":"second",}'])(
      'WHEN parsing %j THEN rejects it',
      (response: string): void => {
        expect((): unknown => answerOf(response, 'codex')).toThrow(AgentJsonError);
      }
    );

    it('WHEN a JSON number overflows THEN rejects it rather than later serializing it as null', (): void => {
      expect((): unknown => answerOf('{"amount":1e400}', 'claude')).toThrow(Error);
    });
  });

  describe('GIVEN an invalid transport envelope', (): void => {
    it.each(['null', '[]', '"text"', '```json\n{}\n```'])('WHEN parsing %s THEN requires a JSON object', (text: string): void => {
      expect((): unknown => parseAgentEnvelope(text, 'gemini')).toThrow(Error);
    });
  });
});
