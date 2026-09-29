import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Resolve `outDir` against the working directory and create it; returns the absolute directory. */
export const createOutDir = async (outDir: string): Promise<string> => {
  const directory = resolve(outDir);

  await mkdir(directory, { recursive: true });

  return directory;
};

export const writeOutFile = async (file: string, content: string): Promise<void> => {
  await writeFile(file, content);
};
