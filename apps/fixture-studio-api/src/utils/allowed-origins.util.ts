import { FixtureError } from '@fixture-automation/openapi-fixtures';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:4200', 'http://127.0.0.1:4200'];
const ORIGIN_FIX = 'list origins like http://localhost:4200 in STUDIO_ALLOWED_ORIGINS';

/** `scheme://host[:port]` as a browser sends it in `Origin`; a trailing slash or path is dropped. */
const normalizedOrigin = (entry: string): string => {
  const isUrl = URL.canParse(entry);

  if (!isUrl) throw new FixtureError(`allowed origin "${entry}" is not a URL`, ORIGIN_FIX);

  const { origin } = new URL(entry);

  if (origin === 'null') throw new FixtureError(`allowed origin "${entry}" has no http(s) origin`, ORIGIN_FIX);

  return origin;
};

/** The Angular dev server origins plus every entry of a comma-separated `STUDIO_ALLOWED_ORIGINS` value, normalized. */
export const allowedOrigins = (extraOrigins: string | undefined): string[] => {
  const entries = extraOrigins?.split(',') ?? [];
  const trimmed = entries.map((entry: string): string => entry.trim());
  const extra = trimmed.filter(Boolean).map(normalizedOrigin);
  const unique = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra]);

  return [...unique];
};

/** `Host` values the API answers: loopback on `port`, plus each allowed origin's host, which a dev proxy forwards unchanged. */
export const allowedHosts = (port: number, origins: string[]): string[] => {
  const loopback = [`127.0.0.1:${port}`, `localhost:${port}`];
  const proxied = origins.map((origin: string): string => new URL(origin).host);
  const unique = new Set([...loopback, ...proxied]);

  return [...unique];
};
