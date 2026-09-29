import { describe, expect, it } from 'vitest';

import { parseJsonOrUndefined } from './json.util.ts';

describe('FEATURE: lenient JSON parsing', (): void => {
  it('GIVEN valid JSON WHEN parsed THEN returns its value', (): void => {
    expect(parseJsonOrUndefined('{"id":1}')).toStrictEqual({ id: 1 });
  });

  it.each([
    ['text that is not JSON', 'Server exploded'],
    ['an empty string', '']
  ])('GIVEN %s WHEN parsed THEN returns undefined', (_label, text): void => {
    expect(parseJsonOrUndefined(text)).toBeUndefined();
  });
});
