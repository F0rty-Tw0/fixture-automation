import { describe, expect, it } from 'vitest';

import { requestRejection } from './request-guard.util.ts';
import type { RequestAccess, RequestIdentity } from '../common/studio-server.type.ts';

const ACCESS: RequestAccess = {
  allowedOrigins: ['http://localhost:4200'],
  allowedHosts: ['127.0.0.1:3333', 'localhost:3333', 'localhost:4200']
};
const CURL: RequestIdentity = { host: '127.0.0.1:3333', origin: undefined, fetchSite: undefined };

const messageOf = (identity: RequestIdentity): string | undefined => requestRejection(identity, ACCESS)?.message;

describe('FEATURE: request guard', (): void => {
  describe('GIVEN the Host header', (): void => {
    it.each(['127.0.0.1:3333', 'localhost:3333', 'LOCALHOST:3333', 'localhost:4200'])('WHEN it is %s THEN passes', (host: string): void => {
      const identity: RequestIdentity = { ...CURL, host };

      expect(messageOf(identity)).toBeUndefined();
    });

    it.each<[string, string | undefined]>([
      ['a rebinding domain', 'evil.example:3333'],
      ['another port', '127.0.0.1:9999'],
      ['empty', ''],
      ['missing', undefined]
    ])('WHEN it is %s THEN is refused', (_label: string, host: string | undefined): void => {
      const identity: RequestIdentity = { ...CURL, host };

      expect(messageOf(identity)).toBe('host not allowed');
    });
  });

  describe('GIVEN an Origin header on a known host', (): void => {
    it('WHEN it is allowed THEN passes even with a cross-site fetch', (): void => {
      const identity: RequestIdentity = { ...CURL, origin: 'http://localhost:4200', fetchSite: 'cross-site' };

      expect(messageOf(identity)).toBeUndefined();
    });

    it.each(['https://evil.example', 'null', 'http://localhost:4201'])('WHEN it is %s THEN is refused', (origin: string): void => {
      const identity: RequestIdentity = { ...CURL, origin };

      expect(messageOf(identity)).toBe('origin not allowed');
    });
  });

  describe('GIVEN no Origin header on a known host', (): void => {
    it.each<[string | undefined]>([[undefined], ['same-origin'], ['none']])('WHEN Sec-Fetch-Site is %s THEN passes', (fetchSite: string | undefined): void => {
      const identity: RequestIdentity = { ...CURL, fetchSite };

      expect(messageOf(identity)).toBeUndefined();
    });

    it.each<[string | string[]]>([['cross-site'], ['same-site'], [['same-origin', 'cross-site']]])(
      'WHEN Sec-Fetch-Site is %s THEN is refused as cross-site',
      (fetchSite: string | string[]): void => {
        const identity: RequestIdentity = { ...CURL, fetchSite };

        expect(messageOf(identity)).toBe('cross-site request refused');
      }
    );
  });
});
