import { relative, resolve } from 'node:path';

import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';
import { typescriptImport } from '../../typescript-stub/utils/typescript-import.util.ts';
import { assertTypesFile } from '../data-access/types-file.client.ts';

/** The module specifier a `--ts` stub uses to import the generated types, after checking the types file exists. */
export const typesImportFor = async (typesFile: string, outFile: string | undefined): Promise<string> => {
  if (!typesFile) throw new FixtureError('--ts requires a path to the generated types file');

  const hasDestination = outFile !== undefined && outFile !== '';
  const outputPath = resolve(hasDestination ? outFile : 'stub.ts');
  const typesPath = resolve(typesFile);
  const outputDifference = relative(typesPath, outputPath);

  if (hasDestination && !outputDifference) throw new FixtureError('the stub destination must differ from the types file');

  await assertTypesFile(typesPath, typesFile);

  return typescriptImport(outputPath, typesPath);
};
