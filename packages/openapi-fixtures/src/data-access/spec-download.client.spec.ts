import { afterEach, describe, expect, it } from 'vitest';

import { downloadedText } from './spec-download.client.ts';
import type { ServedSpec } from '../test/common/served-spec.type.ts';
import { servedSpec, stalledSpec } from '../test/utils/served-spec.spec.util.ts';

const LOCAL_COPY_FIX = 'download the spec and pass it as a file:// URL';
const MEGABYTE = 1024 * 1024;

describe('FEATURE: spec download', (): void => {
  let hosted: ServedSpec | undefined;

  afterEach(async (): Promise<void> => {
    await hosted?.dispose();
    hosted = undefined;
  });

  describe('GIVEN a body within the byte limit', (): void => {
    it('WHEN downloaded THEN returns the text', async (): Promise<void> => {
      hosted = await servedSpec('{"openapi":"3.0.0"}');
      const options = { maxBytes: 64 };

      const text = await downloadedText(hosted.url, options);

      expect(text).toBe('{"openapi":"3.0.0"}');
    });
  });

  describe('GIVEN a body over the byte limit', (): void => {
    it('WHEN it declares its length THEN fails naming the limit in MB', async (): Promise<void> => {
      hosted = await servedSpec('x'.repeat(MEGABYTE + 1));
      const url = hosted.url;
      const options = { maxBytes: MEGABYTE };

      const download = downloadedText(url, options);

      await expect(download).rejects.toThrow(
        expect.objectContaining({ message: `spec at ${url.href} exceeds the 1 MB download limit`, fix: LOCAL_COPY_FIX })
      );
    });

    it('WHEN it streams without a length THEN the streamed bytes are counted', async (): Promise<void> => {
      hosted = await stalledSpec('x'.repeat(64));
      const url = hosted.url;
      const options = { maxBytes: 16, timeoutMs: 5_000 };

      const download = downloadedText(url, options);

      await expect(download).rejects.toThrow(`spec at ${url.href} exceeds the 16 bytes download limit`);
    });
  });

  describe('GIVEN a host that stops answering', (): void => {
    it('WHEN it never sends headers THEN fails with the timeout', async (): Promise<void> => {
      hosted = await stalledSpec();
      const url = hosted.url;
      const options = { timeoutMs: 200 };

      const download = downloadedText(url, options);

      await expect(download).rejects.toThrow(
        expect.objectContaining({ message: `spec download timed out after 200 ms for ${url.href}`, fix: LOCAL_COPY_FIX })
      );
    });

    it('WHEN it stalls mid-body THEN fails with the timeout', async (): Promise<void> => {
      hosted = await stalledSpec('{"openapi":');
      const url = hosted.url;
      const options = { timeoutMs: 200 };

      const download = downloadedText(url, options);

      await expect(download).rejects.toThrow(`spec download timed out after 200 ms for ${url.href}`);
    });
  });

  describe('GIVEN a failing HTTP status', (): void => {
    it('WHEN downloaded THEN reports the status', async (): Promise<void> => {
      hosted = await servedSpec('nope', 500);
      const url = hosted.url;

      const download = downloadedText(url, {});

      await expect(download).rejects.toThrow(`spec download failed: HTTP 500 for ${url.href}`);
    });
  });
});
