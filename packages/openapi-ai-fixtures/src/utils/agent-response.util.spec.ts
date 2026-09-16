import { describe, expect, it } from 'vitest';

import { AgentJsonError } from './agent-json.error.ts';
import { parseAgentEnvelope, parseAgentJson } from './agent-response.util.ts';

describe('FEATURE: coding tool JSON responses', (): void => {
  describe('GIVEN one complete JSON code fence', (): void => {
    it('WHEN parsing a labelled response THEN preserves the enclosed JSON value', (): void => {
      const response = '```json\n{"id":"example","memo":"Keep ```json and ``` inside strings"}\n```';

      const value = parseAgentJson(response, 'gemini');

      expect(value).toStrictEqual({ id: 'example', memo: 'Keep ```json and ``` inside strings' });
    });

    it('WHEN parsing an unlabelled CRLF response THEN accepts surrounding whitespace', (): void => {
      const response = ' \r\n```\r\n[1,false,null]\r\n```\r\n\t';

      const value = parseAgentJson(response, 'gemini');

      expect(value).toStrictEqual([1, false, null]);
    });

    it('WHEN an enclosed number overflows THEN rejects it rather than weakening JSON validation', (): void => {
      expect((): unknown => parseAgentJson('```json\n{"amount":1e400}\n```', 'gemini')).toThrow(AgentJsonError);
    });
  });

  describe('GIVEN plain JSON containing literal code-fence text', (): void => {
    it('WHEN parsing THEN leaves string contents unchanged', (): void => {
      const response = '{"memo":"```json\\n{}\\n```"}';

      const value = parseAgentJson(response, 'gemini');

      expect(value).toStrictEqual({ memo: '```json\n{}\n```' });
    });
  });

  describe('GIVEN ambiguous or incomplete fenced output', (): void => {
    it.each([
      'Here is the result:\n```json\n{"id":"example"}\n```',
      '```json\n{"id":"example"}\n```\nExplanation follows.',
      '```json\n{"id":"first"}\n```\n```json\n{"id":"second"}\n```',
      '```javascript\n{"id":"example"}\n```',
      '```json\n{"id":"example"}'
    ])('WHEN parsing %s THEN rejects it without extracting a convenient fragment', (response: string): void => {
      expect((): unknown => parseAgentJson(response, 'gemini')).toThrow(AgentJsonError);
    });
  });

  describe('GIVEN a non-JSON model response', (): void => {
    it('WHEN parsing malformed JSON inside a fence THEN preserves the original response on the error', (): void => {
      const response = '```json\n{"id":}\n```';
      let error: unknown;

      try {
        parseAgentJson(response, 'claude');
      } catch (cause: unknown) {
        error = cause;
      }

      expect(error).toBeInstanceOf(AgentJsonError);

      if (!(error instanceof AgentJsonError)) throw error;

      expect(error.response).toBe(response);
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('WHEN parsing trailing prose THEN rejects the ambiguous result', (): void => {
      expect((): unknown => parseAgentJson('{"id":"example"} explanation', 'codex')).toThrow(Error);
    });

    it('WHEN a JSON number overflows THEN rejects it rather than later serializing it as null', (): void => {
      expect((): unknown => parseAgentJson('{"amount":1e400}', 'claude')).toThrow(Error);
    });
  });

  describe('GIVEN an invalid transport envelope', (): void => {
    it.each(['null', '[]', '"text"', '```json\n{}\n```'])('WHEN parsing %s THEN requires a JSON object', (text: string): void => {
      expect((): unknown => parseAgentEnvelope(text, 'gemini')).toThrow(Error);
    });
  });
});
