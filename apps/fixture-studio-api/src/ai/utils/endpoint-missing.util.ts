import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import type { MissingFile } from '../../contract/common/studio-api.type.ts';
import { endpointSchemaName } from '../../specs/utils/endpoint-schema.util.ts';

/** The endpoint's schema name, or a `FixtureError` when `missing` was diffed against another schema. */
export const endpointMissing = (spec: OpenApiSpec, endpointId: string, missing: MissingFile): string => {
  const schemaName = endpointSchemaName(spec, endpointId);
  const isSameSchema = missing.schemaName === schemaName;

  if (!isSameSchema) {
    throw new FixtureError(
      `missing was diffed against schema "${missing.schemaName}", not "${schemaName}"`,
      'run the diff again for this endpoint'
    );
  }

  return schemaName;
};
