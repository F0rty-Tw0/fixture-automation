import { describe, expect, it } from 'vitest';

import { parseGeminiStream } from './gemini-stream.util.ts';
import { agentResponse } from '../../test/utils/agent-response.spec.util.ts';

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

  describe('GIVEN the model narrates and calls a tool before answering', (): void => {
    it('WHEN parsing THEN returns only the assistant text after the last tool result', (): void => {
      const narration = JSON.stringify({
        content: 'Filling the fixture.',
        delta: true,
        role: 'assistant',
        timestamp: '2026-09-16T00:00:01.000Z',
        type: 'message'
      });
      const toolUse = JSON.stringify({
        parameters: {},
        timestamp: '2026-09-16T00:00:01.100Z',
        tool_id: 'tool-1',
        tool_name: 'update_topic',
        type: 'tool_use'
      });
      const toolResult = JSON.stringify({
        output: 'Current topic: "Fixture"',
        status: 'success',
        timestamp: '2026-09-16T00:00:01.200Z',
        tool_id: 'tool-1',
        type: 'tool_result'
      });
      const answer = agentResponse('gemini', '{"id":"fixture-1"}').replace(`${init}\n`, '');
      const output = `${init}\n${narration}\n${toolUse}\n${toolResult}\n${answer}`;

      const response = parseGeminiStream(output);

      expect(response).toBe('{"id":"fixture-1"}');
    });
  });

  describe('GIVEN the model answers and then calls a tool to recap', (): void => {
    it('WHEN parsing THEN returns the answer turn', (): void => {
      const toolUse = JSON.stringify({
        parameters: {},
        timestamp: '2026-09-16T00:00:01.100Z',
        tool_id: 'tool-2',
        tool_name: 'update_topic',
        type: 'tool_use'
      });
      const toolResult = JSON.stringify({
        output: 'Current topic: "Recap"',
        status: 'success',
        timestamp: '2026-09-16T00:00:01.200Z',
        tool_id: 'tool-2',
        type: 'tool_result'
      });
      const result = JSON.stringify({ stats: {}, status: 'success', timestamp: '2026-09-16T00:00:02.000Z', type: 'result' });
      const output = `${init}\n${assistantMessage}\n${toolUse}\n${toolResult}\n${result}\n`;

      const response = parseGeminiStream(output);

      expect(response).toBe('{"id":"fixture-1"}');
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
