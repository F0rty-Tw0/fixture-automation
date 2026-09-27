import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isMissingFile } from '@fixture-automation/shared';

import { downloadedText } from './spec-download.client.ts';
import { FixtureError } from '../common/fixture.error.ts';
import type { OpenApiSpec } from '../common/openapi.type.ts';
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

const fileText = async (url: URL): Promise<string> => {
  try {
    const text = await readFile(url, 'utf8');

    return text;
  } catch (error: unknown) {
    const isMissing = isMissingFile(error);

    if (!isMissing) throw error;

    throw new FixtureError(`spec file not found: ${fileURLToPath(url)}`, 'check the path inside the file:// URL');
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
