import type { StepState, StudioProgress, StudioSteps } from '../common/studio.type.ts';

/** The first unfinished step is active; everything before it is done, everything after it waits. */
export const studioSteps = (progress: StudioProgress): StudioSteps => {
  const { hasSpec, hasFixtures, hasDiff, isFilling, hasMerge } = progress;
  const finished = [hasSpec, hasFixtures, hasFixtures, hasDiff, isFilling, hasMerge];
  const activeIndex = finished.indexOf(false);

  const stateAt = (index: number): StepState => {
    const isDone = activeIndex === -1 || index < activeIndex;

    if (isDone) return 'done';

    return index === activeIndex ? 'active' : 'pending';
  };

  const steps: StudioSteps = {
    spec: stateAt(0),
    endpoints: stateAt(1),
    generate: stateAt(2),
    compare: stateAt(3),
    missing: stateAt(4),
    fill: stateAt(5)
  };

  return steps;
};
