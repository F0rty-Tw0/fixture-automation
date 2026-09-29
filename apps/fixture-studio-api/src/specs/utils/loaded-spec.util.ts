import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { listEndpoints } from './endpoint-list.util.ts';
import type { LoadedSpec } from '../../contract/common/studio-api.type.ts';

const infoText = (spec: OpenApiSpec, key: string): string => {
  const value = spec.info?.[key];

  return typeof value === 'string' ? value : '';
};

/** What the UI shows for a freshly loaded spec: `info.title`, `info.version` (empty when absent) and its endpoints. */
export const loadedSpec = (specId: string, spec: OpenApiSpec): LoadedSpec => {
  const title = infoText(spec, 'title');
  const version = infoText(spec, 'version');
  const endpoints = listEndpoints(spec);
  const loaded: LoadedSpec = { specId, title, version, endpoints };

  return loaded;
};
