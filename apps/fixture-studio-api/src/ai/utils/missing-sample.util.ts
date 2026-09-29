import { fixtures } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { openApiDocument } from '../../specs/utils/openapi-document.util.ts';

const MISSING_KEY = 'missing';

/** Sampler values for exactly the missing projection, so merging them fills every reported path. */
export const missingSample = (missing: MissingFile): Record<string, unknown> => {
  const schemas = { ...missing.components.schemas, [MISSING_KEY]: missing.schema };
  const components = { schemas };
  const upload = { openapi: '3.0.0', components };
  const spec = openApiDocument(upload);
  const sample = fixtures(spec)(MISSING_KEY);

  if (!isRecord(sample)) throw new Error('the missing projection did not sample to an object');

  return sample;
};
