import { typescriptImport, typescriptStub } from '@fixture-automation/openapi-fixtures';
import { generateTypes } from '@fixture-automation/openapi-types';
import { sample } from 'openapi-sampler';

import type { FixtureDiff } from '../common/missing.type.ts';

const MISSING_NAME = 'missing';
const MISSING_ALIAS = `export type Missing = components['schemas']['${MISSING_NAME}'];`;
const DOCUMENT_INFO = { title: MISSING_NAME, version: '0' };
const SAMPLE_OPTIONS = {};

/**
 * A self-contained OpenAPI 3.1 document holding the projection and every schema its `$ref`s reach.
 * The prepared schemas are already 2020-12 shaped, so it always declares 3.1.
 */
export const missingDocument = (diff: FixtureDiff): Record<string, unknown> => {
  const schemas = { [MISSING_NAME]: diff.schema, ...diff.components.schemas };
  const components = { schemas };
  const missingDoc = { openapi: '3.1.0', info: DOCUMENT_INFO, components };

  return missingDoc;
};

export const missingTypes = async (missingDoc: Record<string, unknown>): Promise<string> => {
  const types = await generateTypes(missingDoc);

  return `${types}\n${MISSING_ALIAS}\n`;
};

/** Placeholder values for a manual fill; the AI step consumes `missing.json` instead. */
export const missingStub = (diff: FixtureDiff, missingDoc: Record<string, unknown>, stubFile: string, typesFile: string): string => {
  const value = sample(diff.schema, SAMPLE_OPTIONS, missingDoc);
  const json = JSON.stringify(value, null, 2);
  const typesImport = typescriptImport(stubFile, typesFile);

  return typescriptStub(MISSING_NAME, typesImport, json);
};
