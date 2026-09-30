import type { MissingFill } from '@fixture-automation/openapi-ai-fixtures';
import { schemaSample } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { openApiDocument } from '../../specs/utils/openapi-document.util.ts';

const MISSING_KEY = 'missing';

/**
 * Sampler values for exactly the missing projection, so merging them fills every reported path: an object, or a list
 * with one element for a list fixture's projection.
 */
export const missingSample = (missing: MissingFile): MissingFill => {
  const schemas = { ...missing.components.schemas, [MISSING_KEY]: missing.schema };
  const components = { schemas };
  const upload = { openapi: '3.0.0', components };
  const spec = openApiDocument(upload);
  const sample = schemaSample(spec, MISSING_KEY);

  if (Array.isArray(sample)) {
    const list: unknown[] = sample;

    return list;
  }

  if (!isRecord(sample)) throw new Error('the missing projection did not sample to an object or a list');

  return sample;
};
