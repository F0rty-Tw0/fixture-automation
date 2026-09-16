import { describe, expect, it } from 'vitest';

import { parseGeminiStream } from './gemini-stream.util.ts';
import { agentResponse } from '../test/utils/agent-response.spec.util.ts';

const init = JSON.stringify({
  model: 'gemini-test',
  session_id: 'session-1',
  timestamp: '2026-09-16T00:00:00.000Z',
  type: 'init'
});

const assistantMessage = JSON.stringify({
  content: '{"id":"fixture-1"}',
  delta: true,
  role: 'assistant',
  timestamp: '2026-09-16T00:00:01.000Z',
  type: 'message'
});

describe('FEATURE: Gemini stream parsing', (): void => {
  describe('GIVEN a stream has no initial session event', (): void => {
    it('WHEN parsing THEN rejects the malformed stream', (): void => {
      const output = agentResponse('gemini', '{"id":"fixture-1"}').replace(`${init}\n`, '');
      const parse = (): string => parseGeminiStream(output);

      expect(parse).toThrow('Gemini CLI stream did not begin with an init event.');
    });
  });

  describe('GIVEN a stream contains an invalid JSONL record', (): void => {
    it('WHEN parsing THEN rejects rather than extracting partial assistant text', (): void => {
      const output = `${init}\n${assistantMessage}\nnot-json\n`;
      const parse = (): string => parseGeminiStream(output);

      expect(parse).toThrow('gemini returned invalid JSON');
    });
  });

  describe('GIVEN a successful result is followed by another event', (): void => {
    it('WHEN parsing THEN rejects because result is not terminal', (): void => {
      const trailingMessage = JSON.stringify({
        content: 'unexpected',
        delta: true,
        role: 'assistant',
        timestamp: '2026-09-16T00:00:03.000Z',
        type: 'message'
      });
      const output = `${agentResponse('gemini', '{"id":"fixture-1"}')}${trailingMessage}\n`;
      const parse = (): string => parseGeminiStream(output);

      expect(parse).toThrow('Gemini CLI emitted an event after its terminal result.');
    });
  });

  describe('GIVEN a successful result has no assistant content', (): void => {
    it('WHEN parsing THEN rejects instead of returning an empty fixture', (): void => {
      const result = JSON.stringify({
        stats: {},
        status: 'success',
        timestamp: '2026-09-16T00:00:01.000Z',
        type: 'result'
      });
      const output = `${init}\n${result}\n`;
      const parse = (): string => parseGeminiStream(output);

      expect(parse).toThrow('Gemini CLI completed without assistant response text.');
    });
  });
});
