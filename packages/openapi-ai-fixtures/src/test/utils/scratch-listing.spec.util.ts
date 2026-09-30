import type { Dirent } from 'node:fs';
import { join, relative, sep } from 'node:path';

const relativeFilePath = (directory: string, entry: Dirent): string => {
  const absolutePath = join(entry.parentPath, entry.name);
  const segments = relative(directory, absolutePath).split(sep);

  return segments.join('/');
};

/** The files under `directory`, as sorted `/`-joined relative paths; directories are left out so the list matches staged file paths. */
export const scratchFilePaths = (directory: string, entries: Dirent[]): string[] => {
  const files = entries.filter((entry): boolean => entry.isFile());
  const paths = files.map((entry): string => relativeFilePath(directory, entry));

  return paths.toSorted();
};
