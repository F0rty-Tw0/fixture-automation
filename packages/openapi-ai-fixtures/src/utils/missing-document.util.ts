import type { AnySchema } from 'ajv';

import { MISSING_SCHEMA_NAME } from '../common/missing.const.ts';
import type { MissingFile } from '../common/missing.type.ts';
import { SCHEMA_IDENTIFIER } from '../common/schema-identifier.const.ts';

/**
 * Self-contained schema document for the absent properties: the projection under a `missing`
 * component plus only the schemas the diff already pruned to what it references. The full
 * prepared spec is deliberately excluded; it exceeds the agent's 1 MiB input limit on large specs.
 */
export const missingDocument = (missing: MissingFile): AnySchema => {
  const schemas = { ...missing.components.schemas, [MISSING_SCHEMA_NAME]: missing.schema };
  const components = { schemas };
  const identifier = SCHEMA_IDENTIFIER[missing.dialect];
  const reference = `#/components/schemas/${MISSING_SCHEMA_NAME}`;
  const document: AnySchema = { $schema: identifier, $ref: reference, components };

  return document;
};
