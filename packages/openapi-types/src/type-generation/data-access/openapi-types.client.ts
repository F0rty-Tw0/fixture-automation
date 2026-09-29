import openapiTS, { astToString } from 'openapi-typescript';

import { isOpenApiDocument } from '../utils/openapi-document.util.ts';

/**
 * Return TypeScript type declarations for an OpenAPI 3.x spec.
 *
 * Pass an http(s):// or file:// URL to fetch the spec, or an already parsed document
 * carrying `openapi` and `info`.
 */
export async function generateTypes(spec: string | URL | Record<string, unknown>): Promise<string> {
  const isUrl = typeof spec === 'string' || spec instanceof URL;

  if (isUrl) {
    const url = new URL(spec);
    const urlAst = await openapiTS(url);

    return astToString(urlAst);
  }

  if (!isOpenApiDocument(spec)) throw new Error('an in-memory OpenAPI document requires openapi and info');

  const ast = await openapiTS(spec);

  return astToString(ast);
}
