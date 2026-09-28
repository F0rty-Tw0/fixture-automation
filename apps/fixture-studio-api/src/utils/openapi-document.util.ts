import { FixtureError, refuseSwagger } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';

const isOpenApiSpec = (upload: Record<string, unknown>): upload is OpenApiSpec => {
  const hasVersion = typeof upload['openapi'] === 'string';
  const hasPaths = isRecord(upload['paths']);
  const hasComponents = isRecord(upload['components']);
  const hasSections = hasPaths || hasComponents;

  return hasVersion && hasSections;
};

/** An uploaded document, accepted once it carries an `openapi` version string and `paths` or `components`. */
export const openApiDocument = (upload: Record<string, unknown>): OpenApiSpec => {
  refuseSwagger(upload, 'the uploaded document');

  if (!isOpenApiSpec(upload)) {
    throw new FixtureError(
      'the uploaded document is not an OpenAPI spec',
      'upload the JSON document with openapi and paths or components'
    );
  }

  return upload;
};
