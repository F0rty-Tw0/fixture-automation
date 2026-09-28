import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { appendProgress } from './ai-log.util.ts';

const line = (text: string): AiFillProgressEvent => {
  const event: AiFillProgressEvent = { type: 'progress', stream: 'stdout', text };

  return event;
};

const status = (text: string): AiFillProgressEvent => {
  const event: AiFillProgressEvent = { type: 'progress', stream: 'status', text };

  return event;
};

const texts = (lines: AiFillProgressEvent[]): string[] => lines.map((event) => event.text);

describe('FEATURE: streamed progress log', (): void => {
  describe('GIVEN the log ends with model output', (): void => {
    it('WHEN more output arrives THEN it grows the same entry', (): void => {
      const lines = appendProgress([status('Starting'), line('{"memo":')], line(' "Net 30"}\n'), 10, 100);

      expect(texts(lines)).toStrictEqual(['Starting', '{"memo": "Net 30"}\n']);
    });

    it('WHEN the grown entry passes the block limit THEN keeps its tail behind a cut mark', (): void => {
      const lines = appendProgress([line('abcdef')], line('ghij'), 10, 4);

      expect(texts(lines)).toStrictEqual(['…ghij']);
    });

    it('WHEN a status line arrives THEN it starts a new entry without its newline', (): void => {
      const lines = appendProgress([line('abc')], status('Done.\n'), 10, 100);

      expect(texts(lines)).toStrictEqual(['abc', 'Done.']);
    });

    it('WHEN more output arrives THEN leaves the input unchanged', (): void => {
      const original = [line('a')];

      appendProgress(original, line('b'), 10, 100);

      expect(texts(original)).toStrictEqual(['a']);
    });
  });

  describe('GIVEN the log ends with a status line', (): void => {
    it('WHEN model output arrives THEN it opens a new entry, keeping its newline', (): void => {
      const lines = appendProgress([status('Starting')], line('{"a":1}\n'), 10, 100);

      expect(texts(lines)).toStrictEqual(['Starting', '{"a":1}\n']);
    });

    it('WHEN oversized output arrives THEN the new entry keeps only its tail', (): void => {
      const lines = appendProgress([status('Starting')], line('abcdef'), 10, 3);

      expect(texts(lines)).toStrictEqual(['Starting', '…def']);
    });

    it('WHEN the log is full THEN the oldest entry is dropped', (): void => {
      const lines = appendProgress([status('a'), status('b')], status('c'), 2, 100);

      expect(texts(lines)).toStrictEqual(['b', 'c']);
    });
  });

  it('GIVEN an empty log WHEN model output arrives THEN it is the first entry', (): void => {
    const lines = appendProgress([], line('x'), 10, 100);

    expect(texts(lines)).toStrictEqual(['x']);
  });
});
