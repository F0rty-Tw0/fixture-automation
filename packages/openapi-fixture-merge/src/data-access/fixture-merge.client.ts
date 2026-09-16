import { join } from 'node:path';
import { styleText } from 'node:util';

import { prepareSchema } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError, loadSpec, readJsonFile, resolveSchemaName, writeTextFile } from '@fixture-automation/openapi-fixtures';
import { isRecord, selectFixtureShape } from '@fixture-automation/shared';

import { loadPopulated } from './load-populated.client.ts';
import type { FillResult, MergeInput, MergeProvenance, MergeResult, MergeSpec } from '../common/fixture-merge.type.ts';
import { deepFill } from '../utils/deep-fill.util.ts';
import { endpointArtifactFileName, endpointIdentity, sha256Content } from '../utils/merge-artifact-hashing.util.ts';

const assertValid = async (spec: MergeSpec, value: unknown): Promise<void> => {
  const document = await loadSpec(spec.url);
  const schemaName = resolveSchemaName(document, spec.schemaName);
  const prepared = prepareSchema(document, schemaName);

  if (prepared.validate(value)) return;

  const errors = prepared.validate.errors ?? [];
  const messages = errors.map((error): string => {
    const path = error.instancePath || '/';
    const message = error.message ?? error.keyword;

    return `${path}: ${message}`;
  });
  const details = messages.join('; ');
  const fix = 'fix the listed paths in the populated file, or re-run the AI fill';

  throw new FixtureError(`merged fixture violates schema "${schemaName}": ${details}`, fix);
};

const prefixedFilledPaths = (filled: string[], objectShape: string): string[] => {
  const prefixPath = (path: string): string => {
    const isArrayPath = path.startsWith('[');

    if (!path || isArrayPath) return `${objectShape}${path}`;

    return `${objectShape}.${path}`;
  };
  const prefixed = filled.map(prefixPath);

  return prefixed;
};

const mergeValue = (corrupt: unknown, populated: unknown, objectShape: string | undefined): FillResult => {
  if (objectShape === undefined) return deepFill(corrupt, populated);

  const corruptPayload = selectFixtureShape(corrupt, objectShape);
  const populatedPayload = selectFixtureShape(populated, objectShape);
  const mergedPayload = deepFill(corruptPayload, populatedPayload);
  const isCorruptEnvelope = isRecord(corrupt);

  if (!isCorruptEnvelope) throw new Error(`fixture has no own property "${objectShape}" for object-shape`);

  const value = { ...corrupt, [objectShape]: mergedPayload.value };
  const filled = prefixedFilledPaths(mergedPayload.filled, objectShape);
  const merged: FillResult = { value, filled };

  return merged;
};

const optionalValue = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed === '' ? undefined : trimmed;
};

/** Fill the corrupt fixture, optionally validate it, then write two-space endpoint-named artifacts. */
export const mergeFixture = async (input: MergeInput): Promise<MergeResult> => {
  const objectShape = optionalValue(input.objectShape);
  const subdirectory = optionalValue(input.subdirectory);
  const corrupt = await readJsonFile('corrupt fixture', input.corruptFile);
  const populated = await loadPopulated(input.populatedFile);
  const merged = mergeValue(corrupt, populated, objectShape);
  const validationValue = selectFixtureShape(merged.value, objectShape);

  console.error(styleText('green', `filled ${merged.filled.length} path(s)`, { stream: process.stderr }));

  if (input.spec === undefined) {
    console.error(styleText('yellow', 'warning: result not validated (no --spec)', { stream: process.stderr }));
  } else {
    await assertValid(input.spec, validationValue);
  }

  const json: unknown = JSON.stringify(merged.value, null, 2);

  if (typeof json !== 'string') throw new Error('cannot write a non-JSON merged fixture');

  const jsonSource = `${json}\n`;
  const artifactEndpoint = endpointIdentity(input.endpointUrl, subdirectory);
  const outFileName = endpointArtifactFileName(artifactEndpoint);
  const artifactStem = outFileName.slice(0, -'.json'.length);
  const outFile = join(input.outDir, outFileName);
  const provenanceFile = join(input.outDir, `${artifactStem}.provenance.json`);
  const sha256 = sha256Content(jsonSource);
  const provenance: MergeProvenance = { endpointUrl: artifactEndpoint, sha256 };
  const provenanceSource = `${JSON.stringify(provenance, null, 2)}\n`;

  await writeTextFile(outFile, jsonSource);
  await writeTextFile(provenanceFile, provenanceSource);

  const result: MergeResult = {
    value: merged.value,
    filled: merged.filled,
    outFile,
    provenanceFile,
    provenance
  };

  return result;
};
