import { join } from 'node:path';
import { styleText } from 'node:util';

import { prepareSchema } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError, loadSpec, readJsonFile, resolveSchemaName, writeTextFile } from '@fixture-automation/openapi-fixtures';

import { loadPopulated } from './load-populated.client.ts';
import type { MergeInput, MergeProvenance, MergeResult, MergeSpec } from '../common/fixture-merge.type.ts';
import { deepFill } from '../utils/deep-fill.util.ts';
import { endpointArtifactFileName, sha256Content } from '../utils/merge-artifact-hashing.util.ts';

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

/** Fill the corrupt fixture, optionally validate it, then write two-space endpoint-named artifacts. */
export const mergeFixture = async (input: MergeInput): Promise<MergeResult> => {
  const corrupt = await readJsonFile('corrupt fixture', input.corruptFile);
  const populated = await loadPopulated(input.populatedFile);
  const merged = deepFill(corrupt, populated);

  console.error(styleText('green', `filled ${merged.filled.length} path(s)`, { stream: process.stderr }));

  if (input.spec === undefined)
    console.error(styleText('yellow', 'warning: result not validated (no --spec)', { stream: process.stderr }));
  else await assertValid(input.spec, merged.value);

  const json: unknown = JSON.stringify(merged.value, null, 2);

  if (typeof json !== 'string') throw new Error('cannot write a non-JSON merged fixture');

  const jsonSource = `${json}\n`;
  const outFileName = endpointArtifactFileName(input.endpointUrl);
  const artifactStem = outFileName.slice(0, -'.json'.length);
  const outFile = join(input.outDir, outFileName);
  const provenanceFile = join(input.outDir, `${artifactStem}.provenance.json`);
  const sha256 = sha256Content(jsonSource);
  const provenance: MergeProvenance = { endpointUrl: input.endpointUrl, sha256 };
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
