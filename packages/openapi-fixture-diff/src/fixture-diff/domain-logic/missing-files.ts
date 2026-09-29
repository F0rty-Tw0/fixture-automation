import { join } from 'node:path';

import type { FixtureDiff, MissingFiles } from '../common/missing.type.ts';
import { createOutDir, writeOutFile } from '../data-access/missing-files.store.ts';
import { missingDocument, missingStub, missingTypes } from '../utils/missing-output.util.ts';

const missingPaths = (directory: string): MissingFiles => {
  const files: MissingFiles = {
    jsonFile: join(directory, 'missing.json'),
    typesFile: join(directory, 'missing.d.ts'),
    stubFile: join(directory, 'missing.stub.ts')
  };

  return files;
};

/** Write `missing.json`, `missing.d.ts` and `missing.stub.ts` into `outDir`; `missing.json` leaves the baseline out. */
export const writeMissingFiles = async (diff: FixtureDiff, outDir: string): Promise<MissingFiles> => {
  const directory = await createOutDir(outDir);
  const files = missingPaths(directory);
  const document = missingDocument(diff);
  const types = await missingTypes(document);
  const stub = missingStub(diff, document, files.stubFile, files.typesFile);

  const { schemaName, dialect, paths, replaced, schema, components } = diff;
  const missingFile = { schemaName, dialect, paths, replaced, schema, components };

  await writeOutFile(files.jsonFile, `${JSON.stringify(missingFile, null, 2)}\n`);
  await writeOutFile(files.typesFile, types);
  await writeOutFile(files.stubFile, stub);

  return files;
};

/** Write the diff's baseline, the fixture without its replaced values, as `baseline.json` into `outDir`. */
export const writeBaselineFile = async (diff: FixtureDiff, outDir: string): Promise<string> => {
  const directory = await createOutDir(outDir);
  const baselineFile = join(directory, 'baseline.json');

  await writeOutFile(baselineFile, `${JSON.stringify(diff.baseline, null, 2)}\n`);

  return baselineFile;
};
