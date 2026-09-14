import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadSpec } from '@fixture-automation/openapi-fixtures';

import type { ServedSpec } from '../test/common/served-spec.type.ts';
import { fixtureUrl } from '../test/utils/fixture-url.spec.util.ts';
import { servedSpec } from '../test/utils/served-spec.spec.util.ts';

describe('FEATURE: OpenAPI specification loading', (): void => {
  describe('GIVEN a file URL for an invoice specification', (): void => {
    it('WHEN loaded THEN exposes the invoice schema', async (): Promise<void> => {
      const invoice = { required: ['id', 'amount_due', 'status'] };
      const schemas = { invoice };
      const components = { schemas };
      const expected = { components };

      const spec = await loadSpec(fixtureUrl());

      expect(spec).toMatchObject(expected);
    });
  });

  describe('GIVEN an HTTP URL for a specification', (): void => {
    let hosted: ServedSpec;

    beforeAll(async (): Promise<void> => {
      hosted = await servedSpec('{"components":{"schemas":{}}}');
    });

    afterAll(async (): Promise<void> => {
      await hosted.dispose();
    });

    it('WHEN loaded THEN parses the response as a specification', async (): Promise<void> => {
      const components = { schemas: {} };
      const expected = { components };

      const spec = await loadSpec(hosted.url.href);

      expect(spec).toStrictEqual(expected);
    });
  });

  describe('GIVEN a bare filesystem path instead of a URL', (): void => {
    it('WHEN loaded THEN asks for a URL and offers the file URL', async (): Promise<void> => {
      await expect(loadSpec('invoice.json')).rejects.toThrow('spec must be a URL, got bare path "invoice.json"');
    });
  });

  describe('GIVEN a URL whose scheme is neither http, https nor file', (): void => {
    it('WHEN loaded THEN names the unsupported scheme', async (): Promise<void> => {
      await expect(loadSpec('ftp://example.com/spec.json')).rejects.toThrow('unsupported spec URL scheme "ftp:"');
    });
  });

  describe('GIVEN a file URL pointing at nothing', (): void => {
    it('WHEN loaded THEN reports the missing spec file', async (): Promise<void> => {
      const url = new URL('../test/fixtures/invoice/absent.json', import.meta.url);

      await expect(loadSpec(url)).rejects.toThrow('spec file not found:');
    });
  });

  describe('GIVEN a hosted specification behind a stack of failures', (): void => {
    let hosted: ServedSpec | undefined;

    afterEach(async (): Promise<void> => {
      await hosted?.dispose();
      hosted = undefined;
    });

    it('WHEN the host answers 404 THEN it reports the status code', async (): Promise<void> => {
      hosted = await servedSpec('<html>not found</html>', 404);

      await expect(loadSpec(hosted.url.href)).rejects.toThrow(`spec download failed: HTTP 404 for ${hosted.url.href}`);
    });

    it('WHEN the body is YAML THEN it says the loader reads JSON only', async (): Promise<void> => {
      hosted = await servedSpec('openapi: 3.0.0\ncomponents:\n  schemas: {}\n');

      await expect(loadSpec(hosted.url.href)).rejects.toThrow('is YAML; this loader reads JSON only');
    });

    it('WHEN the body is an HTML page THEN it says the body is not JSON', async (): Promise<void> => {
      hosted = await servedSpec('<html><body>sign in</body></html>');

      await expect(loadSpec(hosted.url.href)).rejects.toThrow('is not JSON:');
    });

    it('WHEN the body is a fixture rather than a document THEN it asks for the OpenAPI document', async (): Promise<void> => {
      hosted = await servedSpec('{"id":"in_123","amount_due":0}');

      await expect(loadSpec(hosted.url.href)).rejects.toThrow('has no components.schemas');
    });
  });

  describe('GIVEN a host that cannot be reached', (): void => {
    it('WHEN loaded THEN reports the download failure', async (): Promise<void> => {
      await expect(loadSpec('http://127.0.0.1:1/spec.json')).rejects.toThrow('spec download failed for http://127.0.0.1:1/spec.json:');
    });
  });
});
