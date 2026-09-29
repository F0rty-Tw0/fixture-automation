import { describe, expect, it } from 'vitest';

import { endpointArtifactFileName, endpointIdentity, sha256Content } from './merge-artifact-hashing.util.ts';

describe('FEATURE: merge artifact hashing', (): void => {
  describe('GIVEN an endpoint whose SHA-1 Base64 hash contains several slashes', (): void => {
    it('WHEN deriving the artifact filename THEN every slash becomes lowercase x', (): void => {
      const endpointUrl = 'https://api.example.com/v1/invoices/in_46';

      const fileName = endpointArtifactFileName(endpointUrl);

      expect(fileName).toBe('yBSv3yoqzkQxRnXYwxTIex7l8mI=.json');
    });
  });

  describe('GIVEN an HTTP method endpoint and a slash-wrapped subdirectory', (): void => {
    it('WHEN deriving the artifact identity THEN it prefixes only the endpoint path', (): void => {
      const endpointUrl = 'GET, /custodies/v2';
      const subdirectory = '/savings/';

      const identity = endpointIdentity(endpointUrl, subdirectory);
      const fileName = endpointArtifactFileName(identity);

      expect(identity).toBe('GET,savings/custodies/v2');
      expect(fileName).toBe('A1eWVIW3jNsYQIoF4+npW9FHXp0=.json');
    });
  });

  describe('GIVEN a lowercase method endpoint and the savings-v2 subdirectory', (): void => {
    it('WHEN deriving the artifact filename THEN hashes the canonical method and compact comma separator', (): void => {
      const identity = endpointIdentity('get, custodies/v2', 'savings-v2');
      const fileName = endpointArtifactFileName(identity);

      expect(identity).toBe('GET,savings-v2/custodies/v2');
      expect(fileName).toBe('pr3BjNLuLB11QZrlaK508hgrGXY=.json');
    });
  });

  describe('GIVEN a method endpoint without a usable subdirectory', (): void => {
    it.each([undefined, ' / '])('WHEN the prefix is %s THEN still canonicalizes method casing and spacing', (prefix): void => {
      const identity = endpointIdentity('get , custodies/v2', prefix);
      const fileName = endpointArtifactFileName(identity);

      expect(identity).toBe('GET,custodies/v2');
      expect(fileName).toBe('U1Jw5lHsb+ZLFXUQyBdFG4ibeK4=.json');
    });
  });

  describe('GIVEN a method endpoint with a leading slash and no subdirectory', (): void => {
    it('WHEN deriving the artifact identity THEN it strips the leading slash so both spellings hash alike', (): void => {
      const identity = endpointIdentity('GET, /v1/invoices', undefined);
      const fileName = endpointArtifactFileName(identity);

      expect(identity).toBe('GET,v1/invoices');
      expect(identity).toBe(endpointIdentity('GET, v1/invoices', undefined));
      expect(fileName).toBe('OWzbMzaHATEVIEad+9Zr9i1sJwQ=.json');
    });
  });

  describe('GIVEN a bare endpoint and a subdirectory', (): void => {
    it('WHEN deriving the artifact identity THEN it prefixes the endpoint path', (): void => {
      const endpointUrl = '/custodies/v2';
      const subdirectory = '/savings/';

      const identity = endpointIdentity(endpointUrl, subdirectory);

      expect(identity).toBe('savings/custodies/v2');
    });
  });

  describe('GIVEN an endpoint with no subdirectory', (): void => {
    it('WHEN deriving the artifact identity THEN it keeps the endpoint bytes unchanged', (): void => {
      const endpointUrl = 'https://Api.Example.com/v1/invoices/in_2?fields=id,status';

      const identity = endpointIdentity(endpointUrl, undefined);

      expect(identity).toBe(endpointUrl);
    });
  });

  describe('GIVEN JSON content with a UTF-8 character and final newline', (): void => {
    it('WHEN hashing the content THEN it returns the lowercase SHA-256 hex checksum', (): void => {
      const content = '{\n  "greeting": "héllo"\n}\n';

      const checksum = sha256Content(content);

      expect(checksum).toBe('b2b84c49b12f5547a9755b752dc7428567fe2e060957be5110486857c304d52f');
    });
  });
});
