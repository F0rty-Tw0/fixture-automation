import { describe, expect, it } from 'vitest';

import { formatSize, mimeTypeOf } from './file-size.util.ts';

describe('FEATURE: text size formatting', (): void => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [2.5 * 1024 * 1024, '2.5 MB']
  ])('GIVEN %i characters WHEN formatted THEN reads %s', (length, expected): void => {
    const text = 'x'.repeat(length);

    expect(formatSize(text)).toBe(expected);
  });
});

describe('FEATURE: export MIME type', (): void => {
  it('GIVEN a JSON file WHEN typed THEN is application/json', (): void => {
    expect(mimeTypeOf('Invoice.json')).toBe('application/json');
  });

  it('GIVEN a TypeScript file WHEN typed THEN is plain text', (): void => {
    expect(mimeTypeOf('Invoice.d.ts')).toBe('text/plain');
  });
});
