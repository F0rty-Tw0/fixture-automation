import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { FixtureError } from '../common/fixture.error.ts';
import { errorMessage } from '../utils/error-message.util.ts';

const MISSING_FIX = 'check the path; it is resolved from the current directory';

/** `true` when Node reported the path as absent (`ENOENT`), for reads and writes alike. */
export const isMissingFile = (error: unknown): boolean => {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
};

const fileLabel = (label: string, file: string): string => {
  return `${label} file "${file}"`;
};

/** Read a UTF-8 file, naming both the input it belongs to and the path when it is absent. */
export const readTextFile = async (label: string, file: string): Promise<string> => {
  try {
    const text = await readFile(file, 'utf8');

    return text;
  } catch (error: unknown) {
    const isMissing = isMissingFile(error);

    if (!isMissing) throw error;

    throw new FixtureError(`${fileLabel(label, file)} does not exist`, MISSING_FIX);
  }
};

/** Read a UTF-8 JSON file; a parse failure names the file instead of only the character offset. */
export const readJsonFile = async (label: string, file: string): Promise<unknown> => {
  const text = await readTextFile(label, file);

  try {
    const parsed: unknown = JSON.parse(text);

    return parsed;
  } catch (error: unknown) {
    throw new FixtureError(`${fileLabel(label, file)} is not valid JSON: ${errorMessage(error)}`);
  }
};

/** Write a UTF-8 file, creating any missing parent directories first. */
export const writeTextFile = async (file: string, content: string): Promise<void> => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
};
