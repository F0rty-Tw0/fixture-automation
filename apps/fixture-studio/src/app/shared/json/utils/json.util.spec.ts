import { describe, expect, it } from 'vitest';

import { parseEmbeddedJson, parseJsonOrUndefined } from './json.util.ts';

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

describe('FEATURE: JSON embedded in a model answer', (): void => {
  it.each([
    ['bare JSON', '{"memo":"Net 30"}', { memo: 'Net 30' }],
    ['a Markdown fence', '```json\n{"memo":"Net 30"}\n```', { memo: 'Net 30' }],
    ['prose around it', 'Here are the values:\n{"memo":"Net 30"}\nHope this helps.', { memo: 'Net 30' }],
    ['a fenced array', '```\n[1, 2]\n```', [1, 2]],
    ['a bracketed aside before the object', '[note] Here you go: {"memo":"Net 30"}', { memo: 'Net 30' }]
  ])('GIVEN %s WHEN parsed THEN returns the JSON value', (_label, text, expected): void => {
    expect(parseEmbeddedJson(text)).toStrictEqual(expected);
  });

  it.each([
    ['prose only', 'I cannot help with that.'],
    ['a broken object', 'Values: {"memo": }'],
    ['a closing brace before the opening one', '} then {']
  ])('GIVEN %s WHEN parsed THEN returns undefined', (_label, text): void => {
    expect(parseEmbeddedJson(text)).toBeUndefined();
  });
});
