import { describe, expect, it } from 'vitest';

import { isScriptSource, parseJsonSource, prettyJson, readLiteral, rejectedLiteral } from './fixture-source.util.ts';

describe('FEATURE: fixture source helpers', (): void => {
  it.each(['invoice.ts', 'invoice.stub.ts', 'invoice.mts', 'invoice.js', 'INVOICE.TS'])(
    'GIVEN %s WHEN classified THEN is a script source',
    (name): void => {
      expect(isScriptSource(name)).toBe(true);
    }
  );

  it.each(['invoice.json', 'Pasted text', 'invoice.d.json'])('GIVEN %s WHEN classified THEN is not a script source', (name): void => {
    expect(isScriptSource(name)).toBe(false);
  });

  it('GIVEN valid JSON WHEN parsed THEN returns its value', (): void => {
    expect(parseJsonSource('{"id":1}', 'a.json')).toStrictEqual(readLiteral({ id: 1 }));
  });

  it('GIVEN invalid JSON WHEN parsed THEN names the source', (): void => {
    expect(parseJsonSource('{id:1}', 'a.json')).toStrictEqual(rejectedLiteral('a.json is not valid JSON.'));
  });

  it('GIVEN a value WHEN pretty-printed THEN uses two-space JSON with a final newline', (): void => {
    expect(prettyJson({ id: 1 })).toBe('{\n  "id": 1\n}\n');
  });
});
