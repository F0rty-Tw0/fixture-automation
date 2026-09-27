import { FixtureError } from '../common/fixture.error.ts';
import type { SpecLoadOptions } from '../common/openapi.type.ts';
import { errorMessage } from '../utils/error-message.util.ts';

const MEGABYTE = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 20 * MEGABYTE;
const DOWNLOAD_FIX = 'open the URL in a browser; it must return raw JSON';
const NETWORK_FIX = 'check the host name and your network access';
const LOCAL_COPY_FIX = 'download the spec and pass it as a file:// URL';

const causeMessage = (error: unknown): string => {
  if (error instanceof Error && error.cause instanceof Error) return error.cause.message;

  return errorMessage(error);
};

const byteLabel = (bytes: number): string => {
  const isWholeMegabytes = bytes % MEGABYTE === 0;

  if (isWholeMegabytes) return `${bytes / MEGABYTE} MB`;

  return `${bytes} bytes`;
};

const downloadError = (url: URL, error: unknown, timeoutMs: number): FixtureError => {
  const isTimeout = error instanceof Error && error.name === 'TimeoutError';

  if (isTimeout) return new FixtureError(`spec download timed out after ${timeoutMs} ms for ${url.href}`, LOCAL_COPY_FIX);

  return new FixtureError(`spec download failed for ${url.href}: ${causeMessage(error)}`, NETWORK_FIX);
};

/** The body as text, counting the streamed bytes instead of trusting `content-length`. */
const cappedText = async (response: Response, url: URL, maxBytes: number): Promise<string> => {
  if (response.body === null) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;

  for (;;) {
    const chunk = await reader.read();

    if (chunk.done) break;

    const value: unknown = chunk.value;

    if (!(value instanceof Uint8Array)) throw new Error('spec download produced a non-byte chunk');

    bytes += value.byteLength;

    if (bytes > maxBytes) {
      await reader.cancel();

      throw new FixtureError(`spec at ${url.href} exceeds the ${byteLabel(maxBytes)} download limit`, LOCAL_COPY_FIX);
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
};

/** An http(s) spec body, failing with a `FixtureError` past `timeoutMs` (30 s) or `maxBytes` (20 MB). */
export const downloadedText = async (url: URL, options: SpecLoadOptions = {}): Promise<string> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const signal = AbortSignal.timeout(timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch (error: unknown) {
    throw downloadError(url, error, timeoutMs);
  }

  if (!response.ok) {
    await response.body?.cancel();

    throw new FixtureError(`spec download failed: HTTP ${response.status} for ${url.href}`, DOWNLOAD_FIX);
  }

  try {
    return await cappedText(response, url, maxBytes);
  } catch (error: unknown) {
    if (error instanceof FixtureError) throw error;

    throw downloadError(url, error, timeoutMs);
  }
};
