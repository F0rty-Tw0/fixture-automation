import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import type { LoadSpecBody, LoadedSpec } from '../../contract/common/studio-api.type.ts';
import type { SpecStore } from '../common/specs.type.ts';
import { loadedSpec } from '../utils/loaded-spec.util.ts';
import { openApiDocument } from '../utils/openapi-document.util.ts';

const specFrom = async (body: LoadSpecBody): Promise<OpenApiSpec> => {
  if ('url' in body) return loadSpec(body.url);

  return openApiDocument(body.document);
};

/** Loads the spec `body` names, caches it, and lists its endpoints under its new `specId`. */
export const cacheLoadedSpec = async (cache: SpecStore, body: LoadSpecBody): Promise<LoadedSpec> => {
  const spec = await specFrom(body);
  const specId = cache.add(spec);

  return loadedSpec(specId, spec);
};
