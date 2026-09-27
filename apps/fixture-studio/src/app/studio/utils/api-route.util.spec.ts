import { describe, expect, it } from 'vitest';

import { specActionUrl } from './api-route.util.ts';

describe('FEATURE: spec action routes', (): void => {
  it('GIVEN a plain spec id WHEN building a route THEN nests the action under the spec', (): void => {
    expect(specActionUrl('spec-1', 'diff')).toBe('/api/specs/spec-1/diff');
  });

  it('GIVEN a spec id with reserved characters WHEN building a route THEN encodes it', (): void => {
    expect(specActionUrl('a/b c', 'generate')).toBe('/api/specs/a%2Fb%20c/generate');
  });

  it('GIVEN a camel-cased action WHEN building a route THEN uses its hyphenated path', (): void => {
    expect(specActionUrl('spec-1', 'aiFill')).toBe('/api/specs/spec-1/ai-fill');
  });
});
