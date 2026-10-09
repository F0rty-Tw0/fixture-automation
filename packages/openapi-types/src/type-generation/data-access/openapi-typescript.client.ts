import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { OpenAPI3 } from 'openapi-typescript';

import type { TypesRenderer } from '../common/openapi-types.type.ts';

/** The packages `openapi-typescript` needs at load time, with the command that installs each. */
const INSTALL_COMMANDS = new Map([
  ['typescript', 'npm i typescript@5'],
  ['openapi-typescript', 'npm i openapi-typescript@7']
]);
const MISSING_PACKAGE = /^Cannot find package '(?<name>[^']+)'/u;

/** The package Node's ESM loader could not find, or `undefined` for any other failure. */
const missingPackage = (error: unknown): string | undefined => {
  if (!(error instanceof Error)) return undefined;

  const code: unknown = Reflect.get(error, 'code');

  if (code !== 'ERR_MODULE_NOT_FOUND') return undefined;

  const match = MISSING_PACKAGE.exec(error.message);

  return match?.groups?.['name'];
};

const missingPackageError = (error: unknown): FixtureError | undefined => {
  const name = missingPackage(error);

  if (name === undefined) return undefined;

  const install = INSTALL_COMMANDS.get(name);

  if (install === undefined) return undefined;

  return new FixtureError(
    `TypeScript export needs the "${name}" package, which is not installed`,
    `install it next to fixture-studio: ${install}`
  );
};

// Must stay a dynamic import of the external package itself: esbuild hoists a static external import to the top of the
// fixture-studio bundle even when this module is reached only through a dynamic import, which would load `typescript` at start-up.
const importOpenapiTypescript = async (): Promise<TypesRenderer> => {
  const { default: openapiTS, astToString } = await import('openapi-typescript');

  const render = async (source: URL | OpenAPI3): Promise<string> => {
    const ast = await openapiTS(source);

    return astToString(ast);
  };

  return render;
};

/**
 * Loads `openapi-typescript` on first use instead of at module load, so a host without its `typescript` peer still starts
 * and only the TypeScript export fails, with a `FixtureError` naming the missing package; any other import failure is rethrown.
 */
export const loadTypesRenderer = async (
  importRenderer: () => Promise<TypesRenderer> = importOpenapiTypescript
): Promise<TypesRenderer> => {
  try {
    return await importRenderer();
  } catch (error: unknown) {
    const missing = missingPackageError(error);

    if (missing === undefined) throw error;

    throw missing;
  }
};
