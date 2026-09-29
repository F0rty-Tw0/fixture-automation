import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';
import type { OpenApiSpec } from '../../shared/openapi-document/common/openapi.type.ts';
import { downloadedText } from '../data-access/spec-download.client.ts';
import { fileText } from '../data-access/spec-file.client.ts';
import { parseSpec } from '../utils/openapi-spec.util.ts';

const SUPPORTED_PROTOCOLS = ['http:', 'https:', 'file:'];

/** Parse a spec location as a URL, refusing a bare filesystem path with the file:// form to use instead. */
export const parseSpecUrl = (specUrl: string | URL): URL => {
  if (specUrl instanceof URL) return specUrl;

  try {
    return new URL(specUrl);
  } catch {
    const href = pathToFileURL(resolve(specUrl)).href;

    throw new FixtureError(`spec must be a URL, got bare path "${specUrl}"`, `use ${href}`);
  }
};

/** Load an OpenAPI spec as JSON from an http(s):// or file:// URL; a download stops after 30 s or 20 MB. */
export async function loadSpec(specUrl: string | URL): Promise<OpenApiSpec> {
  const url = parseSpecUrl(specUrl);
  const isSupported = SUPPORTED_PROTOCOLS.includes(url.protocol);

  if (!isSupported) throw new FixtureError(`unsupported spec URL scheme "${url.protocol}"`, 'use https:// or file://');

  const isFileUrl = url.protocol === 'file:';

  if (isFileUrl) {
    const text = await fileText(url);

    return parseSpec(text, url);
  }

  const text = await downloadedText(url);

  return parseSpec(text, url);
}
