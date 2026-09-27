import type { LoadSpecBody } from '@fixture-automation/fixture-studio-api/contract';

/** Where a spec came from, short enough for the rail: the URL's host, or "a local file". */
export const specSourceLabel = (body: LoadSpecBody | undefined): string | undefined => {
  if (body === undefined) return undefined;

  if (!('url' in body)) return 'a local file';

  try {
    return new URL(body.url).host;
  } catch {
    return body.url;
  }
};
