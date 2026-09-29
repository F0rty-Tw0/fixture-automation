import { describe, expect, it } from 'vitest';

import { valuePreview } from './value-preview.util.ts';

const ITEMS = { items: [1, 2, 3] };

describe('FEATURE: one-line value preview', (): void => {
  it.each<[string, unknown, string]>([
    ['a string', 'string', '"string"'],
    ['a number', 0, '0'],
    ['null', null, 'null'],
    ['an object', ITEMS, '{"items":[1,2,3]}']
  ])('GIVEN %s WHEN previewed THEN shows it as JSON', (_label, value, expected): void => {
    expect(valuePreview(value, 40)).toBe(expected);
  });

  it('GIVEN a value longer than the limit WHEN previewed THEN cuts it to the limit with an ellipsis', (): void => {
    expect(valuePreview('abcdefghij', 6)).toBe('"abcd…');
  });

  it('GIVEN no value WHEN previewed THEN says undefined', (): void => {
    expect(valuePreview(undefined, 40)).toBe('undefined');
  });
});
