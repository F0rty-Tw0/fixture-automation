import { describe, expect, it } from 'vitest';

import { parseAgentEnvelope, parseAgentJson } from './agent-response.util.ts';

describe('FEATURE: coding tool JSON responses', (): void => {
  describe('GIVEN a non-JSON model response', (): void => {
    it('WHEN parsing markdown THEN rejects it instead of scraping a payload', (): void => {
      expect((): unknown => parseAgentJson('```json\n{"id":"example"}\n```', 'claude')).toThrow(Error);
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
