import { diffFixture, writeBaselineFile, writeMissingFiles } from '@fixture-automation/openapi-fixture-diff';
import { readJsonFile } from '@fixture-automation/openapi-fixtures';

import type { DiffRequest, DiffResult } from '../common/wizard.type.ts';

/**
 * Diff the existing fixture, replacing placeholder and schema-invalid values too; `undefined` when nothing is
 * missing or replaced, so no `missing/` files are written.
 */
export const diffExisting = async (request: DiffRequest): Promise<DiffResult | undefined> => {
  const { spec, schemaName, fixtureFile, outDir, requiredOnly, objectShape } = request;
  const fixture = await readJsonFile('existing-fixture', fixtureFile);
  const diff = diffFixture({ spec, schemaName, fixture, requiredOnly, objectShape, replacePlaceholders: true });
  const isComplete = diff.paths.length === 0;

  if (isComplete) return undefined;

  const { jsonFile, typesFile, stubFile } = await writeMissingFiles(diff, outDir);
  const baselineFile = await writeBaselineFile(diff, outDir);
  const result: DiffResult = { fixture, diff, jsonFile, typesFile, stubFile, baselineFile };

  return result;
};
