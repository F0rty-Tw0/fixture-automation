import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { appendCapped } from './ai-log.util.ts';

const line = (text: string): AiFillProgressEvent => {
  const event: AiFillProgressEvent = { type: 'progress', stream: 'stdout', text };

  return event;
};

describe('FEATURE: capped progress log', (): void => {
  it('GIVEN room under the limit WHEN a line is appended THEN keeps every line', (): void => {
    const lines = appendCapped([line('a')], line('b'), 3);

    expect(lines.map((event) => event.text)).toStrictEqual(['a', 'b']);
  });

  it('GIVEN a full log WHEN a line is appended THEN drops the oldest', (): void => {
    const lines = appendCapped([line('a'), line('b')], line('c'), 2);

    expect(lines.map((event) => event.text)).toStrictEqual(['b', 'c']);
  });

  it('GIVEN a log WHEN a line is appended THEN leaves the input unchanged', (): void => {
    const original = [line('a')];

    appendCapped(original, line('b'), 1);

    expect(original).toHaveLength(1);
  });
});
