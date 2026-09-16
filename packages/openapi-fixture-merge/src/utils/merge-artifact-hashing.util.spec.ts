import { describe, expect, it } from 'vitest';

import { endpointArtifactFileName, sha256Content } from './merge-artifact-hashing.util.ts';

describe('FEATURE: merge artifact hashing', (): void => {
  describe('GIVEN an endpoint whose SHA-1 Base64 hash contains several slashes', (): void => {
    it('WHEN deriving the artifact filename THEN every slash becomes lowercase x', (): void => {
      const endpointUrl = 'https://api.example.com/v1/invoices/in_46';

      const fileName = endpointArtifactFileName(endpointUrl);

      expect(fileName).toBe('yBSv3yoqzkQxRnXYwxTIex7l8mI=.json');
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
