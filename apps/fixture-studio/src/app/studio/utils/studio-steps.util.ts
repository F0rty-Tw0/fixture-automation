import type { StudioSteps } from '../common/studio.type.ts';

/** The first unfinished step is active; everything before it is done, everything after it waits. */
export const studioSteps = (hasSpec: boolean, hasFixtures: boolean): StudioSteps => {
  if (hasFixtures) {
    const reviewing: StudioSteps = { spec: 'done', endpoints: 'done', workspace: 'active' };

    return reviewing;
  }

  if (hasSpec) {
    const picking: StudioSteps = { spec: 'done', endpoints: 'active', workspace: 'pending' };

    return picking;
  }

  const loading: StudioSteps = { spec: 'active', endpoints: 'pending', workspace: 'pending' };

  return loading;
};
