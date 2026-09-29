import { access } from 'node:fs/promises';

import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';

/** Resolve when the `--ts` types file exists; otherwise a `FixtureError` naming the path as given. */
export const assertTypesFile = async (typesPath: string, typesFile: string): Promise<void> => {
  try {
    await access(typesPath);
  } catch {
    throw new FixtureError(`--ts file "${typesFile}" does not exist`, 'check the path; it is resolved from the current directory');
  }
};
