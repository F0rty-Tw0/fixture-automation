import type { RequestAccess, RequestIdentity } from '../common/studio-server.type.ts';
import type { ApiErrorBody } from '../contract/common/studio-api.type.ts';

const TRUSTED_FETCH_SITES = ['same-origin', 'none'];
const FORBIDDEN_HOST: ApiErrorBody = {
  message: 'host not allowed',
  fix: 'call the API on 127.0.0.1 or localhost, or through an origin listed in STUDIO_ALLOWED_ORIGINS'
};
const FORBIDDEN_ORIGIN: ApiErrorBody = {
  message: 'origin not allowed',
  fix: 'open Fixture Studio from an allowed origin, or add yours to STUDIO_ALLOWED_ORIGINS'
};
const CROSS_SITE: ApiErrorBody = {
  message: 'cross-site request refused',
  fix: 'call the API from Fixture Studio itself, or from a tool that sends no Sec-Fetch-Site header'
};

const isTrustedFetchSite = (fetchSite: string | string[] | undefined): boolean => {
  if (fetchSite === undefined) return true;

  if (typeof fetchSite !== 'string') return false;

  return TRUSTED_FETCH_SITES.includes(fetchSite);
};

/**
 * Why a request must be refused, or `undefined` to let it through. The API later spawns paid AI CLIs, so:
 * an unknown `Host` is refused (DNS rebinding), a present `Origin` must be allowed, and without one a browser's
 * `Sec-Fetch-Site` must say the request is not cross-site (`<img src>` and friends send no `Origin`).
 * Tools such as curl send neither header and pass.
 */
export const requestRejection = (identity: RequestIdentity, access: RequestAccess): ApiErrorBody | undefined => {
  const host = identity.host?.toLowerCase() ?? '';
  const isKnownHost = access.allowedHosts.includes(host);

  if (!isKnownHost) return FORBIDDEN_HOST;

  const { origin, fetchSite } = identity;

  if (origin !== undefined) {
    const isAllowedOrigin = access.allowedOrigins.includes(origin);

    return isAllowedOrigin ? undefined : FORBIDDEN_ORIGIN;
  }

  const isTrusted = isTrustedFetchSite(fetchSite);

  return isTrusted ? undefined : CROSS_SITE;
};
