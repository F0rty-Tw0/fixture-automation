import { STUDIO_API_PREFIX, STUDIO_API_ROUTES } from '../common/studio-api.const.ts';

type SpecAction = 'aiFill' | 'aiPrompt' | 'diff' | 'envelope' | 'generate' | 'merge';

/** `/api/specs/<specId>/<action>`, with the spec id encoded. */
export const specActionUrl = (specId: string, action: SpecAction): string => {
  const encodedId = encodeURIComponent(specId);
  const route = STUDIO_API_ROUTES[action].replace(':specId', encodedId);

  return `${STUDIO_API_PREFIX}${route}`;
};
