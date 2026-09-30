import type { AiFillEvent, FillSource } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { parseFillEvent, splitNdjson } from './ndjson.util.ts';

describe('FEATURE: NDJSON splitting', (): void => {
  it('GIVEN complete lines WHEN split THEN returns them with nothing left over', (): void => {
    expect(splitNdjson('{"a":1}\n{"b":2}\n')).toStrictEqual({ lines: ['{"a":1}', '{"b":2}'], rest: '' });
  });

  it('GIVEN a line cut by a chunk boundary WHEN split THEN keeps the partial line as rest', (): void => {
    expect(splitNdjson('{"a":1}\n{"b":')).toStrictEqual({ lines: ['{"a":1}'], rest: '{"b":' });
  });

  it('GIVEN the rest joined with the next chunk WHEN split THEN completes the line', (): void => {
    const first = splitNdjson('{"a":1}\n{"b":');

    const second = splitNdjson(`${first.rest}2}\n`);

    expect(second).toStrictEqual({ lines: ['{"b":2}'], rest: '' });
  });

  it('GIVEN blank and CRLF lines WHEN split THEN drops blanks and trims', (): void => {
    expect(splitNdjson('{"a":1}\r\n\n  \n')).toStrictEqual({ lines: ['{"a":1}'], rest: '' });
  });
});

describe('FEATURE: AI fill event parsing', (): void => {
  it('GIVEN a progress line WHEN parsed THEN returns the progress event', (): void => {
    const expected: AiFillEvent = { type: 'progress', stream: 'stderr', text: 'warn' };

    expect(parseFillEvent('{"type":"progress","stream":"stderr","text":"warn"}')).toStrictEqual(expected);
  });

  it('GIVEN a result line WHEN parsed THEN returns the populated values', (): void => {
    const populated = { status: 'open' };
    const expected: AiFillEvent = { type: 'result', populated };

    expect(parseFillEvent('{"type":"result","populated":{"status":"open"}}')).toStrictEqual(expected);
  });

  it('GIVEN a result line with sources and notes WHEN parsed THEN keeps them', (): void => {
    const populated = { status: 'open', memo: 'Net 30' };
    const sources: Record<string, FillSource> = { status: 'ai', memo: 'sampler' };
    const notes = ['The model left memo out.'];
    const expected: AiFillEvent = { type: 'result', populated, sources, notes };
    const line = JSON.stringify(expected);

    expect(parseFillEvent(line)).toStrictEqual(expected);
  });

  it('GIVEN a result line with malformed sources and notes WHEN parsed THEN drops the malformed entries', (): void => {
    const populated = { status: 'open' };
    const sources: Record<string, FillSource> = { status: 'ai' };
    const expected: AiFillEvent = { type: 'result', populated, sources, notes: ['kept'] };
    const line = '{"type":"result","populated":{"status":"open"},"sources":{"status":"ai","memo":"guess"},"notes":["kept",3]}';

    expect(parseFillEvent(line)).toStrictEqual(expected);
  });

  it('GIVEN a result line for a list fixture WHEN parsed THEN keeps the populated list', (): void => {
    const item = { created: 2 };
    const populated = [item];
    const expected: AiFillEvent = { type: 'result', populated };

    expect(parseFillEvent('{"type":"result","populated":[{"created":2}]}')).toStrictEqual(expected);
  });

  it('GIVEN an error line without a fix WHEN parsed THEN leaves the fix empty', (): void => {
    const expected: AiFillEvent = { type: 'error', message: 'boom', fix: undefined };

    expect(parseFillEvent('{"type":"error","message":"boom"}')).toStrictEqual(expected);
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['a JSON array', '[1]'],
    ['an unknown type', '{"type":"other"}'],
    ['a progress line on an unknown stream', '{"type":"progress","stream":"stdin","text":"x"}'],
    ['a progress line without text', '{"type":"progress","stream":"stdout"}'],
    ['a result without an object', '{"type":"result","populated":3}'],
    ['an error without a message', '{"type":"error"}']
  ])('GIVEN %s WHEN parsed THEN returns nothing', (_label, line): void => {
    expect(parseFillEvent(line)).toBeUndefined();
  });
});
