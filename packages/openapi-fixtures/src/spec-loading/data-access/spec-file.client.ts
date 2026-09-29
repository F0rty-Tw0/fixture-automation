import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { isMissingFile } from '@fixture-automation/shared';

import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';

/** A file:// spec body as UTF-8 text; an absent file is a `FixtureError` naming its path. */
export const fileText = async (url: URL): Promise<string> => {
  try {
    const text = await readFile(url, 'utf8');

    return text;
  } catch (error: unknown) {
    const isMissing = isMissingFile(error);

    if (!isMissing) throw error;

    throw new FixtureError(`spec file not found: ${fileURLToPath(url)}`, 'check the path inside the file:// URL');
  }
};
