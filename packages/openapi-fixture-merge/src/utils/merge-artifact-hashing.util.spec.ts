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

      expect(identity).toBe('GET, savings/custodies/v2');
      expect(fileName).toBe('SyDyiBXH0INxJLx3y+UqNPhAJKc=.json');
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
      const endpointUrl = 'https://api.example.com/v1/invoices/in_2';

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
