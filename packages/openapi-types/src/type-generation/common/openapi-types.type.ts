import type { OpenAPI3 } from 'openapi-typescript';

/** Renders TypeScript declarations for a spec URL or a parsed OpenAPI 3.x document. */
export type TypesRenderer = (source: URL | OpenAPI3) => Promise<string>;
