import { describe, expect, it } from 'vitest';

import { studioSteps } from './studio-steps.util.ts';
import type { StudioSteps } from '../common/studio.type.ts';

describe('FEATURE: pipeline rail state', (): void => {
  it('GIVEN no spec WHEN computed THEN the spec step is active', (): void => {
    const expected: StudioSteps = { spec: 'active', endpoints: 'pending', workspace: 'pending' };

    expect(studioSteps(false, false)).toStrictEqual(expected);
  });

  it('GIVEN a spec without fixtures WHEN computed THEN the endpoints step is active', (): void => {
    const expected: StudioSteps = { spec: 'done', endpoints: 'active', workspace: 'pending' };

    expect(studioSteps(true, false)).toStrictEqual(expected);
  });

  it('GIVEN fixtures WHEN computed THEN the workspace step is active', (): void => {
    const expected: StudioSteps = { spec: 'done', endpoints: 'done', workspace: 'active' };

    expect(studioSteps(true, true)).toStrictEqual(expected);
  });
});
