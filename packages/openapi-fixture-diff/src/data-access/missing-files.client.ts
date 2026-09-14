import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { FixtureDiff, MissingFiles } from '../common/missing.type.ts';
import { missingDocument, missingStub, missingTypes } from '../utils/missing-output.util.ts';

const missingPaths = (directory: string): MissingFiles => {
  const files: MissingFiles = {
    jsonFile: join(directory, 'missing.json'),
    typesFile: join(directory, 'missing.d.ts'),
    stubFile: join(directory, 'missing.stub.ts')
  };

  return files;
};

/** Write `missing.json`, `missing.d.ts` and `missing.stub.ts` into `outDir`. */
export const writeMissingFiles = async (diff: FixtureDiff, outDir: string): Promise<MissingFiles> => {
  const directory = resolve(outDir);

  await mkdir(directory, { recursive: true });

  const files = missingPaths(directory);
  const document = missingDocument(diff);
  const types = await missingTypes(document);
  const stub = missingStub(diff, document, files.stubFile, files.typesFile);

  await writeFile(files.jsonFile, `${JSON.stringify(diff, null, 2)}\n`);
  await writeFile(files.typesFile, types);
  await writeFile(files.stubFile, stub);

  return files;
};
