import { describe, expect, it } from 'vitest';

import { studioSteps } from './studio-steps.util.ts';
import type { StudioProgress, StudioSteps } from '../common/studio.type.ts';

const NOTHING_DONE: StudioProgress = { hasSpec: false, hasFixtures: false, hasDiff: false, isFilling: false, hasMerge: false };

describe('FEATURE: pipeline rail state', (): void => {
  it('GIVEN no spec WHEN computed THEN the spec step is active and the rest waits', (): void => {
    const expected: StudioSteps = {
      spec: 'active',
      endpoints: 'pending',
      generate: 'pending',
      compare: 'pending',
      missing: 'pending',
      fill: 'pending'
    };

    expect(studioSteps(NOTHING_DONE)).toStrictEqual(expected);
  });

  it('GIVEN a spec without fixtures WHEN computed THEN the endpoints step is active', (): void => {
    const progress: StudioProgress = { ...NOTHING_DONE, hasSpec: true };

    expect(studioSteps(progress).endpoints).toBe('active');
    expect(studioSteps(progress).generate).toBe('pending');
  });

  it('GIVEN fixtures WHEN computed THEN generate is done and compare is active', (): void => {
    const progress: StudioProgress = { ...NOTHING_DONE, hasSpec: true, hasFixtures: true };
    const steps = studioSteps(progress);

    expect([steps.endpoints, steps.generate, steps.compare, steps.missing]).toStrictEqual(['done', 'done', 'active', 'pending']);
  });

  it('GIVEN a diff WHEN computed THEN the missing values step is active and AI fill waits', (): void => {
    const progress: StudioProgress = { ...NOTHING_DONE, hasSpec: true, hasFixtures: true, hasDiff: true };
    const steps = studioSteps(progress);

    expect([steps.compare, steps.missing, steps.fill]).toStrictEqual(['done', 'active', 'pending']);
  });

  it('GIVEN the user moved on to AI fill WHEN computed THEN the fill step is active', (): void => {
    const progress: StudioProgress = { hasSpec: true, hasFixtures: true, hasDiff: true, isFilling: true, hasMerge: false };
    const steps = studioSteps(progress);

    expect([steps.missing, steps.fill]).toStrictEqual(['done', 'active']);
  });

  it('GIVEN a merged fill WHEN computed THEN every step is done', (): void => {
    const progress: StudioProgress = { hasSpec: true, hasFixtures: true, hasDiff: true, isFilling: true, hasMerge: true };
    const states = Object.values(studioSteps(progress));

    expect(new Set(states)).toStrictEqual(new Set(['done']));
  });
});
