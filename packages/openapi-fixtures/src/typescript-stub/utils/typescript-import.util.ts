import { dirname, isAbsolute, relative, sep } from 'node:path';

/** Both paths must be absolute so the import does not depend on the working directory. */
export const typescriptImport = (outputPath: string, typesPath: string): string => {
  const outputDirectory = dirname(outputPath);
  const importPath = relative(outputDirectory, typesPath);
  const hasAbsoluteImport = isAbsolute(importPath);

  if (hasAbsoluteImport) throw new Error('the stub and types file must be on the same drive');

  const normalizedImport = importPath.split(sep).join('/');
  const isParentImport = normalizedImport.startsWith('../');

  if (isParentImport) return normalizedImport;

  return `./${normalizedImport}`;
};
