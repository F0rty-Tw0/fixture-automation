import { describe, expect, it } from 'vitest';

import { allowedHosts, allowedOrigins } from './allowed-origins.util.ts';

const DEV_ORIGINS = ['http://localhost:4200', 'http://127.0.0.1:4200'];

describe('FEATURE: allowed origins', (): void => {
  describe('GIVEN no STUDIO_ALLOWED_ORIGINS value', (): void => {
    it('WHEN the list is built THEN holds only the Angular dev server origins', (): void => {
      const origins = allowedOrigins(undefined);

      expect(origins).toStrictEqual(DEV_ORIGINS);
    });
  });

  describe('GIVEN a comma-separated value with blanks and empty entries', (): void => {
    it('WHEN the list is built THEN appends each trimmed, non-empty origin', (): void => {
      const origins = allowedOrigins(' http://studio.local:8080 ,, https://x.dev,');

      expect(origins).toStrictEqual([...DEV_ORIGINS, 'http://studio.local:8080', 'https://x.dev']);
    });
  });

  describe('GIVEN origins written loosely', (): void => {
    it('WHEN the list is built THEN each becomes the origin a browser sends, once', (): void => {
      const origins = allowedOrigins('http://studio.local:8080/, HTTP://Studio.Local:8080/app, http://localhost:4200/');

      expect(origins).toStrictEqual([...DEV_ORIGINS, 'http://studio.local:8080']);
    });
  });

  describe('GIVEN an entry that is not an http(s) origin', (): void => {
    it.each<[string, string]>([
      ['studio.local', 'allowed origin "studio.local" is not a URL'],
      ['file:///tmp/app.html', 'allowed origin "file:///tmp/app.html" has no http(s) origin']
    ])('WHEN it is %s THEN fails naming it', (entry: string, message: string): void => {
      expect((): string[] => allowedOrigins(entry)).toThrow(expect.objectContaining({ message }));
    });
  });

  describe('SCENARIO: allowed hosts', (): void => {
    describe('GIVEN the default origins and port 3333', (): void => {
      it('WHEN hosts are derived THEN hold loopback on the port and each origin host once', (): void => {
        const hosts = allowedHosts(3333, [...DEV_ORIGINS, 'http://localhost:4200']);

        expect(hosts).toStrictEqual(['127.0.0.1:3333', 'localhost:3333', 'localhost:4200', '127.0.0.1:4200']);
      });
    });

    describe('GIVEN an origin on the scheme default port', (): void => {
      it('WHEN hosts are derived THEN its host carries no port, as a browser sends it', (): void => {
        const hosts = allowedHosts(3333, ['https://studio.example']);

        expect(hosts).toContain('studio.example');
      });
    });
  });
});
