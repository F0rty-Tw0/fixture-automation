import { describe, expect, it } from 'vitest';

import { AgentJsonError } from './agent-json.error.ts';
import { parseAgentEnvelope, parseAgentJson } from './agent-response.util.ts';

describe('FEATURE: coding tool JSON responses', (): void => {
  describe('GIVEN a non-JSON model response', (): void => {
    it('WHEN parsing markdown THEN preserves it on the parser error instead of scraping a payload', (): void => {
      const response = '```json\n{"id":"example"}\n```';
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
    it.each(['null', '[]', '"text"'])('WHEN parsing %s THEN requires an object', (text: string): void => {
      expect((): unknown => parseAgentEnvelope(text, 'gemini')).toThrow(Error);
    });
  });
});
