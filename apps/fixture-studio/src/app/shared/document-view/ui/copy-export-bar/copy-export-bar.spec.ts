import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyExportBar } from './copy-export-bar.ts';
import { clipboardMock } from '../../../../test/mocks/browser.mock.ts';
import { textAt } from '../../../../test/utils/fixture-dom.spec.util.ts';

const CONTENT = '{ "id": "in_1" }';

type DownloadCapture = {
  readonly blobs: Blob[];
  readonly anchors: HTMLAnchorElement[];
};

/** jsdom has no object URLs and would navigate on click; record both instead. */
const captureDownloads = (): DownloadCapture => {
  const blobs: Blob[] = [];
  const anchors: HTMLAnchorElement[] = [];
  const createObjectUrl = (blob: Blob): string => {
    blobs.push(blob);

    return 'blob:fixture';
  };
  const recordClick = function (this: HTMLAnchorElement): void {
    anchors.push(this);
  };
  const capture: DownloadCapture = { blobs, anchors };

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(recordClick);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

  return capture;
};

describe('FEATURE: CopyExportBar', (): void => {
  let fixture: ComponentFixture<CopyExportBar>;
  let loader: HarnessLoader;
  let rootLoader: HarnessLoader;
  let clipboard: Clipboard;

  beforeEach(async (): Promise<void> => {
    clipboard = clipboardMock();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    fixture = TestBed.createComponent(CopyExportBar);
    fixture.componentRef.setInput('fileName', 'Invoice.json');
    fixture.componentRef.setInput('content', CONTENT);
    loader = TestbedHarnessEnvironment.loader(fixture);
    rootLoader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('GIVEN a document WHEN rendered THEN shows its file name and size', (): void => {
    expect(textAt(fixture, '.bar__file')).toBe('Invoice.json');
    expect(textAt(fixture, '.bar__size')).toBe('16 B');
  });

  describe('GIVEN clipboard access', (): void => {
    it('WHEN Copy is pressed THEN writes the content and confirms', async (): Promise<void> => {
      const copy = await loader.getHarness(MatButtonHarness.with({ text: 'Copy' }));

      await copy.click();
      const snackBar = await rootLoader.getHarness(MatSnackBarHarness);

      expect(clipboard.writeText).toHaveBeenCalledWith(CONTENT);
      expect(await snackBar.getMessage()).toBe('Copied Invoice.json');
    });
  });

  describe('GIVEN the browser blocks the clipboard', (): void => {
    it('WHEN Copy is pressed THEN suggests Export instead', async (): Promise<void> => {
      vi.mocked(clipboard.writeText).mockRejectedValue(new Error('denied'));
      const copy = await loader.getHarness(MatButtonHarness.with({ text: 'Copy' }));

      await copy.click();
      const snackBar = await rootLoader.getHarness(MatSnackBarHarness);

      expect(await snackBar.getMessage()).toBe('The browser blocked clipboard access. Use Export instead.');
    });
  });

  describe('GIVEN Export', (): void => {
    it('WHEN pressed THEN downloads the content under the file name', async (): Promise<void> => {
      const downloads = captureDownloads();
      const exportButton = await loader.getHarness(MatButtonHarness.with({ text: 'Export' }));

      await exportButton.click();
      const texts = await Promise.all(downloads.blobs.map(async (blob) => blob.text()));

      expect(texts).toStrictEqual([CONTENT]);
      expect(downloads.blobs.map((blob) => blob.type)).toStrictEqual(['application/json']);
      expect(downloads.anchors.map((anchor) => anchor.download)).toStrictEqual(['Invoice.json']);
      expect(downloads.anchors.map((anchor) => anchor.href)).toStrictEqual(['blob:fixture']);
    });
  });
});
