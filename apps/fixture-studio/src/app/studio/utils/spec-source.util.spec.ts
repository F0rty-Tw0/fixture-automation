import { describe, expect, it } from 'vitest';

import { specSourceLabel } from './spec-source.util.ts';

describe('FEATURE: spec source label', (): void => {
  it('GIVEN no source WHEN labelled THEN returns nothing', (): void => {
    expect(specSourceLabel(undefined)).toBeUndefined();
  });

  it('GIVEN a URL WHEN labelled THEN returns its host', (): void => {
    expect(specSourceLabel({ url: 'https://api.example.com:8443/openapi.json' })).toBe('api.example.com:8443');
  });

  it('GIVEN an unparsable URL WHEN labelled THEN returns it as is', (): void => {
    expect(specSourceLabel({ url: 'not a url' })).toBe('not a url');
  });

  it('GIVEN a dropped document WHEN labelled THEN says it is local', (): void => {
    const document = { openapi: '3.1.0' };

    expect(specSourceLabel({ document })).toBe('a local file');
  });
});
