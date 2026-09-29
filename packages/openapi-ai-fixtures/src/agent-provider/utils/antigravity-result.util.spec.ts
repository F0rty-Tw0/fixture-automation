import { describe, expect, it } from 'vitest';

import { parseAntigravityResult } from './antigravity-result.util.ts';
import { antigravityStream } from '../test/utils/antigravity-stream.spec.util.ts';

describe('FEATURE: Antigravity result stream parsing', (): void => {
  describe('GIVEN a successful terminal result with response text', (): void => {
    it('WHEN the stream is parsed THEN returns the complete fixture text unchanged', (): void => {
      const fixtureText = '{"id":"invoice-1","amount":42}';
      const initPayload = { tools: [] };
      const initEvent = { event: 'init', init: initPayload };
      const resultPayload = {
        status: 'SUCCESS',
        response: fixtureText
      };
      const resultEvent = { event: 'result', result: resultPayload };
      const stream = antigravityStream([initEvent, resultEvent]);

      const result = parseAntigravityResult(stream);

      expect(result).toBe(fixtureText);
    });
  });

  describe('GIVEN a successful terminal result with structured output', (): void => {
    it('WHEN the stream is parsed THEN serializes the structured output as fixture text', (): void => {
      const fixture = { id: 'invoice-2', amount: 84 };
      const resultPayload = {
        status: 'SUCCESS',
        response: '{not-used}',
        structured_output: fixture
      };
      const resultEvent = { event: 'result', result: resultPayload };
      const stream = antigravityStream([resultEvent]);

      const result = parseAntigravityResult(stream);

      expect(result).toBe(JSON.stringify(fixture));
    });
  });

  describe('GIVEN a zero-exit stream with an error result', (): void => {
    it('WHEN the stream is parsed THEN rejects the unsuccessful status', (): void => {
      const resultPayload = {
        status: 'ERROR',
        response: '{"id":"unsafe"}',
        error: 'permission denied'
      };
      const resultEvent = { event: 'result', result: resultPayload };
      const stream = antigravityStream([resultEvent]);

      const parse = (): unknown => parseAntigravityResult(stream);

      expect(parse).toThrow('antigravity failed with status ERROR');
    });
  });

  describe('GIVEN a result event followed by another stream event', (): void => {
    it('WHEN the stream is parsed THEN rejects the non-terminal result', (): void => {
      const resultPayload = {
        status: 'SUCCESS',
        response: '{"id":"premature"}'
      };
      const resultEvent = { event: 'result', result: resultPayload };
      const updatePayload = { state: 'DONE', step_type: 'checkpoint' };
      const updateEvent = { event: 'step_update', step_update: updatePayload };
      const stream = antigravityStream([resultEvent, updateEvent]);

      const parse = (): unknown => parseAntigravityResult(stream);

      expect(parse).toThrow('antigravity stream did not end with a result event');
    });
  });

  describe('GIVEN two result events for a one-turn invocation', (): void => {
    it('WHEN the stream is parsed THEN rejects the ambiguous results', (): void => {
      const firstPayload = {
        status: 'SUCCESS',
        response: '{"id":"first"}'
      };
      const secondPayload = {
        status: 'SUCCESS',
        response: '{"id":"second"}'
      };
      const firstEvent = { event: 'result', result: firstPayload };
      const secondEvent = { event: 'result', result: secondPayload };
      const stream = antigravityStream([firstEvent, secondEvent]);

      const parse = (): unknown => parseAntigravityResult(stream);

      expect(parse).toThrow('antigravity stream returned more than one result event');
    });
  });

  describe('GIVEN a successful result with fenced fixture text', (): void => {
    it('WHEN the stream is parsed THEN preserves the text for central JSON validation', (): void => {
      const fixtureText = '```json\n{"id":"invoice-3"}\n```';
      const resultPayload = {
        status: 'SUCCESS',
        response: fixtureText
      };
      const resultEvent = { event: 'result', result: resultPayload };
      const stream = antigravityStream([resultEvent]);

      const result = parseAntigravityResult(stream);

      expect(result).toBe(fixtureText);
    });
  });

  describe('GIVEN a successful terminal result without fixture JSON', (): void => {
    it('WHEN the stream is parsed THEN rejects the incomplete result', (): void => {
      const resultPayload = { status: 'SUCCESS' };
      const resultEvent = { event: 'result', result: resultPayload };
      const stream = antigravityStream([resultEvent]);
      const parse = (): unknown => parseAntigravityResult(stream);

      expect(parse).toThrow('antigravity returned a successful result without fixture JSON');
    });
  });

  describe('GIVEN an empty event stream', (): void => {
    it('WHEN the stream is parsed THEN rejects the missing terminal result', (): void => {
      const parse = (): unknown => parseAntigravityResult(' \n');

      expect(parse).toThrow('antigravity returned an empty event stream');
    });
  });

  describe('GIVEN malformed JSON inside the event stream', (): void => {
    it('WHEN the stream is parsed THEN rejects the malformed event boundary', (): void => {
      const stream = '{"event":"init"}\nnot-json\n';

      const parse = (): unknown => parseAntigravityResult(stream);

      expect(parse).toThrow('antigravity returned invalid JSON');
    });
  });
});
